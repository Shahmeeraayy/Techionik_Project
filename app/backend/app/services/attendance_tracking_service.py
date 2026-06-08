from datetime import datetime, timedelta, timezone
from math import asin, cos, radians, sin, sqrt
from uuid import UUID

from fastapi import HTTPException, Request, status
from sqlalchemy.orm import Session

from ..core.enums import UserRole
from ..core.security import AuthenticatedUser
from ..models import (
    AttendanceAuditLog,
    ChatterLocationRequest,
    ChatterSharedLocation,
    GeoFenceRule,
    GeoFenceValidationLog,
    Job,
    Technician,
    TechnicianAttendanceEvent,
    TechnicianAttendanceSession,
    TechnicianDeviceLog,
    TechnicianLocation,
    TechnicianLocationEvent,
)
from ..schemas.attendance_tracking import (
    AttendanceActionRequest,
    ChatterLocationRequestCreate,
    ChatterLocationShareRequest,
    DeviceLogPayload,
    GeoFenceRuleCreateRequest,
    LocationCheckpointRequest,
    LocationUpdateRequest,
    TechnicianLocationConsentRequest,
)


ATTENDANCE_TO_STATUS = {
    "clock_in": "Available",
    "clock_out": "Offline",
    "break_start": "Break",
    "break_end": "Available",
}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def location_state(last_seen_at: datetime | None) -> str:
    if not last_seen_at:
        return "offline"
    seconds = (utcnow() - last_seen_at).total_seconds()
    if seconds <= 60:
        return "online"
    if seconds <= 300:
        return "recently_active"
    return "offline_stale"


def haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371000
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 2 * radius * asin(sqrt(a))


class AttendanceTrackingService:
    def __init__(self, db: Session, current_user: AuthenticatedUser, request: Request | None = None):
        self.db = db
        self.current_user = current_user
        self.request = request
        self.tenant_id = current_user.tenant_id

    def _ip(self) -> str | None:
        if self.request is None:
            return None
        forwarded = self.request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return self.request.client.host if self.request.client else None

    def _assert_technician_self(self, technician_id: UUID) -> None:
        if self.current_user.role == UserRole.TECHNICIAN and self.current_user.user_id != technician_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Technicians can only manage their own tracking data")

    def _assert_admin(self) -> None:
        if self.current_user.role != UserRole.ADMIN:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access is required")

    def _technician(self, technician_id: UUID) -> Technician:
        technician = self.db.query(Technician).filter(Technician.id == technician_id).first()
        if technician is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Technician not found")
        return technician

    def _audit(self, action: str, technician_id: UUID | None = None, **metadata) -> None:
        attendance_event_id = metadata.pop("attendance_event_id", None)
        location_event_id = metadata.pop("location_event_id", None)
        conversation_id = metadata.pop("conversation_id", None)
        request_id = metadata.pop("request_id", None)
        job_id = metadata.pop("job_id", None)
        self.db.add(AttendanceAuditLog(
            tenant_id=self.tenant_id,
            actor_id=self.current_user.user_id,
            actor_role=self.current_user.role.value,
            technician_id=technician_id,
            job_id=job_id,
            attendance_event_id=attendance_event_id,
            location_event_id=location_event_id,
            conversation_id=conversation_id,
            request_id=request_id,
            action=action,
            metadata_json={key: str(value) for key, value in metadata.items() if value is not None},
        ))

    def _device_log(self, technician_id: UUID, event_type: str, payload: DeviceLogPayload | None, job_id: UUID | None = None) -> TechnicianDeviceLog:
        now = utcnow()
        device = payload or DeviceLogPayload()
        row = TechnicianDeviceLog(
            tenant_id=self.tenant_id,
            technician_id=technician_id,
            event_type=event_type,
            job_id=job_id,
            device_type=device.device_type,
            browser_name=device.browser_name,
            browser_version=device.browser_version,
            operating_system=device.operating_system,
            user_agent=device.user_agent,
            session_id=device.session_id,
            app_version=device.app_version,
            ip_address=self._ip(),
            captured_at=now,
        )
        self.db.add(row)
        self.db.flush()
        self._audit("device_log_created", technician_id, event_type=event_type, device_log_id=row.id)
        return row

    def _latest_location(self, technician_id: UUID) -> TechnicianLocation:
        row = self.db.query(TechnicianLocation).filter(TechnicianLocation.technician_id == technician_id).first()
        if row is None:
            row = TechnicianLocation(
                tenant_id=self.tenant_id,
                technician_id=technician_id,
                tracking_status="offline",
                availability_status="Offline",
                location_permission_status="unknown",
            )
            self.db.add(row)
            self.db.flush()
        return row

    def _validate_geo_fence(self, technician_id: UUID, action_type: str, latitude: float | None, longitude: float | None, accuracy: float | None, job_id: UUID | None = None) -> GeoFenceValidationLog:
        now = utcnow()
        if latitude is None or longitude is None:
            status_value = "gps_unavailable"
            rule = None
            distance = None
        elif accuracy is not None and accuracy > 100:
            status_value = "poor_accuracy"
            rule = None
            distance = None
        else:
            query = self.db.query(GeoFenceRule).filter(GeoFenceRule.is_active.is_(True))
            if job_id is not None:
                query = query.filter((GeoFenceRule.job_id == job_id) | (GeoFenceRule.job_id.is_(None)))
            rule = query.order_by(GeoFenceRule.job_id.desc()).first()
            if rule is None:
                status_value = "not_configured"
                distance = None
            else:
                distance = haversine_meters(latitude, longitude, rule.latitude, rule.longitude)
                inside = distance <= rule.radius_meters
                if inside:
                    status_value = "inside"
                elif rule.mode == "strict":
                    status_value = "blocked"
                else:
                    status_value = "warning"

        row = GeoFenceValidationLog(
            tenant_id=self.tenant_id,
            technician_id=technician_id,
            job_id=job_id,
            action_type=action_type,
            latitude=latitude,
            longitude=longitude,
            accuracy=accuracy,
            target_latitude=rule.latitude if rule else None,
            target_longitude=rule.longitude if rule else None,
            allowed_radius_meters=rule.radius_meters if rule else None,
            distance_from_target_meters=distance,
            geo_fence_status=status_value,
            geo_fence_mode=rule.mode if rule else None,
            validated_at=now,
        )
        self.db.add(row)
        self.db.flush()
        self._audit(
            "geo_fence_action_blocked" if status_value == "blocked" else f"geo_fence_validation_{'failed' if status_value in {'warning', 'poor_accuracy'} else 'passed'}",
            technician_id,
            action_type=action_type,
            status=status_value,
        )
        return row

    def save_consent(self, payload: TechnicianLocationConsentRequest):
        technician_id = self.current_user.user_id
        self._assert_technician_self(technician_id)
        self._technician(technician_id)
        row = self._latest_location(technician_id)
        row.location_permission_status = payload.status
        if payload.status == "granted":
            row.location_consent_given_at = utcnow()
        self._device_log(technician_id, f"location_permission_{payload.status}", payload.device)
        self._audit(f"location_permission_{'granted' if payload.status == 'granted' else 'denied'}", technician_id)
        self.db.commit()
        return row

    def current_attendance(self, technician_id: UUID):
        self._assert_technician_self(technician_id)
        session = (
            self.db.query(TechnicianAttendanceSession)
            .filter(TechnicianAttendanceSession.technician_id == technician_id)
            .filter(TechnicianAttendanceSession.status.in_(["clocked_in", "on_break"]))
            .order_by(TechnicianAttendanceSession.clock_in_at.desc())
            .first()
        )
        if session is None:
            return None
        session.events = (
            self.db.query(TechnicianAttendanceEvent)
            .filter(TechnicianAttendanceEvent.attendance_session_id == session.id)
            .order_by(TechnicianAttendanceEvent.occurred_at.asc())
            .all()
        )
        return session

    def attendance_history(self, technician_id: UUID):
        self._assert_technician_self(technician_id)
        sessions = (
            self.db.query(TechnicianAttendanceSession)
            .filter(TechnicianAttendanceSession.technician_id == technician_id)
            .order_by(TechnicianAttendanceSession.clock_in_at.desc())
            .limit(60)
            .all()
        )
        for session in sessions:
            session.events = (
                self.db.query(TechnicianAttendanceEvent)
                .filter(TechnicianAttendanceEvent.attendance_session_id == session.id)
                .order_by(TechnicianAttendanceEvent.occurred_at.asc())
                .all()
            )
        return sessions

    def attendance_action(self, action: str, payload: AttendanceActionRequest):
        technician_id = self.current_user.user_id
        self._assert_technician_self(technician_id)
        self._technician(technician_id)
        active = self.current_attendance(technician_id)
        now = utcnow()

        if action == "clock_in" and active is not None:
            raise HTTPException(status_code=409, detail="Already clocked in")
        if action != "clock_in" and active is None:
            raise HTTPException(status_code=409, detail="No active attendance session")
        if action == "break_start" and active.status != "clocked_in":
            raise HTTPException(status_code=409, detail="Must be clocked in to start a break")
        if action == "break_end" and active.status != "on_break":
            raise HTTPException(status_code=409, detail="Not currently on break")

        validation = self._validate_geo_fence(technician_id, action, payload.latitude, payload.longitude, payload.accuracy, payload.job_id)
        if validation.geo_fence_status == "blocked":
            self.db.commit()
            raise HTTPException(status_code=422, detail="Action blocked by geo-fence")

        session = active
        if action == "clock_in":
            session = TechnicianAttendanceSession(
                tenant_id=self.tenant_id,
                technician_id=technician_id,
                clock_in_at=now,
                status="clocked_in",
            )
            self.db.add(session)
            self.db.flush()
        elif action == "clock_out":
            self._finish_session(session, now)
            session.status = "clocked_out"
            session.clock_out_at = now
        elif action == "break_start":
            session.status = "on_break"
        elif action == "break_end":
            session.status = "clocked_in"

        device_log = self._device_log(technician_id, action, payload.device, payload.job_id)
        event = TechnicianAttendanceEvent(
            tenant_id=self.tenant_id,
            technician_id=technician_id,
            attendance_session_id=session.id,
            event_type=action,
            latitude=payload.latitude,
            longitude=payload.longitude,
            accuracy=payload.accuracy,
            device_log_id=device_log.id,
            geo_fence_validation_id=validation.id,
            occurred_at=now,
        )
        self.db.add(event)
        self.db.flush()
        device_log.attendance_event_id = event.id
        checkpoint = self._checkpoint(technician_id, action, payload.latitude, payload.longitude, payload.accuracy, payload.job_id, None, event.id)
        device_log.location_event_id = checkpoint.id
        self._apply_latest_location(technician_id, payload.latitude, payload.longitude, payload.accuracy, payload.job_id, ATTENDANCE_TO_STATUS[action])
        self._audit(f"attendance_{action}", technician_id, attendance_event_id=event.id)
        self.db.commit()
        session.events = self.db.query(TechnicianAttendanceEvent).filter(TechnicianAttendanceEvent.attendance_session_id == session.id).all()
        return session

    def _finish_session(self, session: TechnicianAttendanceSession, now: datetime) -> None:
        events = (
            self.db.query(TechnicianAttendanceEvent)
            .filter(TechnicianAttendanceEvent.attendance_session_id == session.id)
            .order_by(TechnicianAttendanceEvent.occurred_at.asc())
            .all()
        )
        break_minutes = 0
        break_started_at = None
        for event in events:
            if event.event_type == "break_start":
                break_started_at = event.occurred_at
            elif event.event_type == "break_end" and break_started_at:
                break_minutes += max(0, int((event.occurred_at - break_started_at).total_seconds() // 60))
                break_started_at = None
        if break_started_at:
            break_minutes += max(0, int((now - break_started_at).total_seconds() // 60))
        total_minutes = max(0, int((now - session.clock_in_at).total_seconds() // 60))
        session.total_minutes = total_minutes
        session.break_minutes = break_minutes
        session.active_work_minutes = max(0, total_minutes - break_minutes)

    def _apply_latest_location(self, technician_id: UUID, latitude: float | None, longitude: float | None, accuracy: float | None, job_id: UUID | None, availability_status: str | None):
        row = self._latest_location(technician_id)
        row.job_id = job_id or row.job_id
        row.latitude = latitude
        row.longitude = longitude
        row.accuracy = accuracy
        row.tracking_status = "active" if latitude is not None and longitude is not None else "gps_unavailable"
        row.availability_status = availability_status or row.availability_status
        row.last_seen_at = utcnow()
        return row

    def update_location(self, payload: LocationUpdateRequest):
        technician_id = self.current_user.user_id
        self._assert_technician_self(technician_id)
        self._technician(technician_id)
        device_log = self._device_log(technician_id, "latest_location_updated", payload.device, payload.job_id)
        row = self._apply_latest_location(
            technician_id,
            payload.latitude,
            payload.longitude,
            payload.accuracy,
            payload.job_id,
            payload.availability_status,
        )
        if payload.tracking_status:
            row.tracking_status = payload.tracking_status
        self._audit("latest_location_updated", technician_id, device_log_id=device_log.id)
        self.db.commit()
        return row

    def _checkpoint(self, technician_id: UUID, event_type: str, latitude: float | None, longitude: float | None, accuracy: float | None, job_id: UUID | None, job_status: str | None, attendance_event_id: UUID | None = None):
        row = TechnicianLocationEvent(
            tenant_id=self.tenant_id,
            technician_id=technician_id,
            job_id=job_id,
            attendance_event_id=attendance_event_id,
            event_type=event_type,
            job_status=job_status,
            latitude=latitude,
            longitude=longitude,
            accuracy=accuracy,
            captured_at=utcnow(),
        )
        self.db.add(row)
        self.db.flush()
        self._audit("location_checkpoint_created", technician_id, location_event_id=row.id, event_type=event_type)
        return row

    def create_checkpoint(self, payload: LocationCheckpointRequest):
        technician_id = self.current_user.user_id
        self._assert_technician_self(technician_id)
        device_log = self._device_log(technician_id, payload.event_type, payload.device, payload.job_id)
        row = self._checkpoint(
            technician_id,
            payload.event_type,
            payload.latitude,
            payload.longitude,
            payload.accuracy,
            payload.job_id,
            payload.job_status,
            payload.attendance_event_id,
        )
        device_log.location_event_id = row.id
        self._apply_latest_location(technician_id, payload.latitude, payload.longitude, payload.accuracy, payload.job_id, self._status_from_job(payload.job_status))
        self.db.commit()
        return row

    def _status_from_job(self, job_status: str | None) -> str | None:
        if not job_status:
            return None
        normalized = job_status.lower()
        if "drive" in normalized or "way" in normalized:
            return "Driving"
        if "arriv" in normalized or "site" in normalized:
            return "On Site"
        if "progress" in normalized or "start" in normalized:
            return "Working"
        if "complete" in normalized:
            return "Available"
        return None

    def admin_dashboard(self):
        self._assert_admin()
        technicians = self.db.query(Technician).all()
        active_sessions = {
            item.technician_id: item for item in self.db.query(TechnicianAttendanceSession).filter(
                TechnicianAttendanceSession.status.in_(["clocked_in", "on_break"])
            ).all()
        }
        locations = {item.technician_id: item for item in self.db.query(TechnicianLocation).all()}
        reports = []
        response_locations = []
        total_work = 0
        total_break = 0
        warnings = self.db.query(GeoFenceValidationLog).filter(GeoFenceValidationLog.geo_fence_status.in_(["warning", "blocked", "outside"])).count()
        for technician in technicians:
            sessions = self.db.query(TechnicianAttendanceSession).filter(TechnicianAttendanceSession.technician_id == technician.id).all()
            work = sum(item.active_work_minutes for item in sessions)
            brk = sum(item.break_minutes for item in sessions)
            total_work += work
            total_break += brk
            reports.append({
                "technician_id": technician.id,
                "technician_name": technician.full_name or technician.name,
                "total_minutes": sum(item.total_minutes for item in sessions),
                "active_work_minutes": work,
                "break_minutes": brk,
                "clock_ins": len(sessions),
                "first_clock_in_at": min([item.clock_in_at for item in sessions], default=None),
                "last_clock_out_at": max([item.clock_out_at for item in sessions if item.clock_out_at], default=None),
                "missed_clock_out": technician.id in active_sessions,
                "geo_fence_violations": warnings,
            })
            loc = locations.get(technician.id)
            if loc:
                job = self.db.query(Job).filter(Job.id == loc.job_id).first() if loc.job_id else None
                response_locations.append({
                    "id": loc.id,
                    "technician_id": technician.id,
                    "technician_name": technician.full_name or technician.name,
                    "job_id": loc.job_id,
                    "latitude": loc.latitude,
                    "longitude": loc.longitude,
                    "accuracy": loc.accuracy,
                    "tracking_status": loc.tracking_status,
                    "availability_status": loc.availability_status,
                    "location_permission_status": loc.location_permission_status,
                    "location_consent_given_at": loc.location_consent_given_at,
                    "last_seen_at": loc.last_seen_at,
                    "location_state": location_state(loc.last_seen_at),
                    "active_job_reference": job.job_code if job else None,
                    "attendance_status": active_sessions.get(technician.id).status if technician.id in active_sessions else "clocked_out",
                })
        checkpoints = self.db.query(TechnicianLocationEvent).order_by(TechnicianLocationEvent.captured_at.desc()).limit(100).all()
        return {
            "summary": {
                "total_technicians": len(technicians),
                "active_technicians": sum(1 for item in response_locations if item["location_state"] == "online"),
                "on_break": sum(1 for item in active_sessions.values() if item.status == "on_break"),
                "offline": sum(1 for item in response_locations if item["location_state"] != "online"),
                "total_work_minutes": total_work,
                "total_break_minutes": total_break,
                "geo_fence_warnings": warnings,
            },
            "locations": response_locations,
            "reports": reports,
            "checkpoints": checkpoints,
        }

    def create_geo_fence_rule(self, payload: GeoFenceRuleCreateRequest):
        self._assert_admin()
        row = GeoFenceRule(tenant_id=self.tenant_id, **payload.dict())
        self.db.add(row)
        self._audit("geo_fence_rule_created")
        self.db.commit()
        self.db.refresh(row)
        return row

    def list_geo_fence_rules(self):
        self._assert_admin()
        return self.db.query(GeoFenceRule).order_by(GeoFenceRule.created_at.desc()).all()

    def create_location_request(self, payload: ChatterLocationRequestCreate):
        self._assert_admin()
        self._technician(payload.technician_id)
        now = utcnow()
        row = ChatterLocationRequest(
            tenant_id=self.tenant_id,
            technician_id=payload.technician_id,
            admin_id=self.current_user.user_id,
            conversation_id=payload.conversation_id,
            message_id=payload.message_id,
            status="pending",
            requested_at=now,
            expires_at=now + timedelta(minutes=10),
        )
        self.db.add(row)
        self.db.flush()
        self._audit("location_request_created", payload.technician_id, request_id=row.id)
        self.db.commit()
        return row

    def pending_location_requests_for_technician(self):
        technician_id = self.current_user.user_id
        self._assert_technician_self(technician_id)
        rows = (
            self.db.query(ChatterLocationRequest)
            .filter(ChatterLocationRequest.technician_id == technician_id)
            .filter(ChatterLocationRequest.status == "pending")
            .order_by(ChatterLocationRequest.requested_at.desc())
            .all()
        )
        expired = False
        now = utcnow()
        for row in rows:
            if row.expires_at <= now:
                row.status = "expired"
                expired = True
                self._audit("location_request_expired", row.technician_id, request_id=row.id)
        if expired:
            self.db.commit()
            rows = [row for row in rows if row.status == "pending"]
        return rows

    def _location_request(self, request_id: UUID) -> ChatterLocationRequest:
        row = self.db.query(ChatterLocationRequest).filter(ChatterLocationRequest.id == request_id).first()
        if row is None:
            raise HTTPException(status_code=404, detail="Location request not found")
        if row.status == "pending" and row.expires_at <= utcnow():
            row.status = "expired"
            self._audit("location_request_expired", row.technician_id, request_id=row.id)
            self.db.commit()
        return row

    def share_location_request(self, request_id: UUID, payload: ChatterLocationShareRequest):
        row = self._location_request(request_id)
        self._assert_technician_self(row.technician_id)
        if row.status != "pending":
            raise HTTPException(status_code=409, detail="Location request is no longer pending")
        if payload.latitude is None or payload.longitude is None:
            raise HTTPException(status_code=422, detail="GPS coordinates are required")
        now = utcnow()
        device_log = self._device_log(row.technician_id, "chatter_location_shared", payload.device)
        shared = ChatterSharedLocation(
            tenant_id=self.tenant_id,
            request_id=row.id,
            conversation_id=row.conversation_id,
            technician_id=row.technician_id,
            admin_id=row.admin_id,
            latitude=payload.latitude,
            longitude=payload.longitude,
            accuracy=payload.accuracy,
            device_log_id=device_log.id,
            shared_at=now,
        )
        self.db.add(shared)
        row.status = "shared"
        row.responded_at = now
        self._checkpoint(row.technician_id, "chatter_location_shared", payload.latitude, payload.longitude, payload.accuracy, None, None)
        self._apply_latest_location(row.technician_id, payload.latitude, payload.longitude, payload.accuracy, None, None)
        self._audit("location_request_shared", row.technician_id, request_id=row.id)
        self.db.commit()
        return shared

    def decline_location_request(self, request_id: UUID):
        row = self._location_request(request_id)
        self._assert_technician_self(row.technician_id)
        if row.status != "pending":
            raise HTTPException(status_code=409, detail="Location request is no longer pending")
        row.status = "declined"
        row.responded_at = utcnow()
        self._audit("location_request_declined", row.technician_id, request_id=row.id)
        self.db.commit()
        return row
