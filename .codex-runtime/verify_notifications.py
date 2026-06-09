import json
import sys
from pathlib import Path
import requests
from sqlalchemy import create_engine, text

sys.path.append(str(Path.cwd()))
from app.core.config import DATABASE_URL

BASE_URL = 'http://127.0.0.1:8001'


def post(path, json_payload=None, headers=None):
    return requests.post(BASE_URL + path, json=json_payload, headers=headers, timeout=30)


def get(path, headers=None):
    return requests.get(BASE_URL + path, headers=headers, timeout=30)


def patch(path, json_payload=None, headers=None):
    return requests.patch(BASE_URL + path, json=json_payload, headers=headers, timeout=30)


def ensure_ok(resp, label):
    if resp.status_code >= 400:
        raise RuntimeError(f'{label} failed: {resp.status_code} {resp.text}')
    return resp.json()


admin_login = ensure_ok(post('/auth/admin-token', {'email': 'admin@nexusops.com', 'password': 'admin123'}), 'admin login')
admin_token = admin_login['access_token']
admin_headers = {'Authorization': f'Bearer {admin_token}'}

tech_payload = {
    'name': 'QA Technician',
    'email': 'qa-tech@nexusops.local',
    'phone': '+14165550099',
    'password': 'tech123',
    'status': 'active',
    'manual_availability': True,
}
tech_resp = requests.post(BASE_URL + '/admin/technicians', json=tech_payload, headers=admin_headers, timeout=30)
if tech_resp.status_code == 409:
    existing_techs = requests.get(BASE_URL + '/admin/technicians', headers=admin_headers, timeout=30).json()
    tech = next(item for item in existing_techs if item.get('email') == tech_payload['email'])
else:
    tech = ensure_ok(tech_resp, 'create technician')
tech_id = tech['id']
tech_email = tech['email']
print('TECH:', tech_id, tech_email)

tech_login = ensure_ok(post('/auth/technician-token', {'email': tech_email, 'password': 'tech123'}), 'technician login')
tech_token = tech_login['access_token']
tech_headers = {'Authorization': f'Bearer {tech_token}'}

service_resp = requests.post(BASE_URL + '/admin/services', json={
    'code': 'qa-notify-service',
    'name': 'QA Notification Service',
    'category': 'General',
    'default_price': '100.00',
    'approval_required': False,
    'status': 'active',
    'notes': 'Service created for notification QA verification',
}, headers=admin_headers, timeout=30)
if service_resp.status_code == 201:
    service = service_resp.json()
    service_id = service['id']
    print('SERVICE_ID:', service_id)
else:
    print('SERVICE_CREATE_STATUS:', service_resp.status_code, service_resp.text)

config = ensure_ok(get('/booking-portal/config'), 'booking config')
services = config.get('services', [])
if not services:
    raise RuntimeError('No booking services available')
service_id = services[0]['id']
print('SERVICE_ID_FROM_CONFIG:', service_id)

booking_payload = {
    'customer_full_name': 'QA Customer',
    'phone_number': '+14165550111',
    'email_address': 'qa-customer@example.com',
    'service_location_address': '123 QA Street',
    'service_location_city': 'Montreal',
    'service_location_state': 'QC',
    'service_location_zip_code': 'H2X 2Y7',
    'service_catalog_ids': [service_id],
    'asset_details': 'Test booking request for notification verification',
    'preferred_date': '2026-06-15',
    'preferred_time_of_day': 'morning',
    'additional_notes': 'Notification QA check',
}
booking = ensure_ok(requests.post(BASE_URL + '/booking-portal/submit', json=booking_payload, timeout=30), 'booking submit')
print('BOOKING_REF:', booking['reference_number'])

engine = create_engine(DATABASE_URL)
with engine.connect() as conn:
    rows = conn.execute(text("SELECT id, event_type, title, recipient_role, recipient_user_id, status, delivered_at FROM notifications WHERE recipient_role='admin' OR recipient_role='technician' ORDER BY created_at DESC LIMIT 20")).fetchall()
print('NOTIFICATIONS_AFTER_BOOKING:')
for row in rows:
    print(row)

job_resp = requests.post(BASE_URL + '/admin/jobs', json={
    'dealership_name': 'QA Dealership',
    'service_name': 'QA Service',
    'vehicle_summary': 'Test Vehicle',
    'pre_assigned_technician_id': tech_id,
}, headers=admin_headers, timeout=30)
print('CREATE_JOB_STATUS', job_resp.status_code, job_resp.text)
job_payload = ensure_ok(job_resp, 'create job')
job_id = str(job_payload['id'])
print('JOB_ID:', job_id)

assign_resp = patch(f'/admin/jobs/{job_id}/assignment', {'assigned_technician_id': tech_id}, admin_headers)
print('ASSIGN_STATUS', assign_resp.status_code, assign_resp.text)

with engine.connect() as conn:
    rows = conn.execute(text("SELECT id, event_type, title, recipient_role, recipient_user_id, status, delivered_at FROM notifications WHERE recipient_role='admin' OR recipient_role='technician' ORDER BY created_at DESC LIMIT 20")).fetchall()
print('NOTIFICATIONS_AFTER_ASSIGNMENT:')
for row in rows:
    print(row)

conv_resp = get(f'/technicians/me/chat/jobs/{job_id}/conversation', tech_headers)
print('CONVERSATION_STATUS', conv_resp.status_code, conv_resp.text)
conv = conv_resp.json()
conversation = conv.get('conversation') or conv
conversation_id = conversation['id']
print('CONVERSATION_ID', conversation_id)

msg_resp = requests.post(BASE_URL + f'/technicians/me/chat/threads/{conversation_id}/messages', json={'text': 'QA notification probe from automated check'}, headers=tech_headers, timeout=30)
print('MESSAGE_STATUS', msg_resp.status_code, msg_resp.text)

with engine.connect() as conn:
    rows = conn.execute(text("SELECT id, event_type, title, recipient_role, recipient_user_id, status, delivered_at FROM notifications WHERE recipient_role='admin' OR recipient_role='technician' ORDER BY created_at DESC LIMIT 20")).fetchall()
print('NOTIFICATIONS_AFTER_CHAT:')
for row in rows:
    print(row)
