from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...api import deps
from ...core.enums import UserRole
from ...core.security import AuthenticatedUser
from ...schemas.admin_services import (
    AdminQuickBooksCustomerSyncResponse,
    AdminQuickBooksSyncResponse,
    AdminQuickBooksTaxCodeSyncResponse,
)
from ...services.quickbooks_customer_sync_service import QuickBooksCustomerSyncService
from ...services.quickbooks_item_sync_service import QuickBooksItemSyncService
from ...services.quickbooks_tax_code_sync_service import QuickBooksTaxCodeSyncService

router = APIRouter(prefix="/admin/quickbooks", tags=["admin-quickbooks"])


@router.post("/sync-items", response_model=AdminQuickBooksSyncResponse)
def sync_quickbooks_items(
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    _ = current_user
    result = QuickBooksItemSyncService(db).sync_items()
    return AdminQuickBooksSyncResponse(
        synced_count=result.synced_count,
        created_count=result.created_count,
        updated_count=result.updated_count,
        archived_count=result.archived_count,
    )


@router.post("/sync-customers", response_model=AdminQuickBooksCustomerSyncResponse)
def sync_quickbooks_customers(
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    _ = current_user
    result = QuickBooksCustomerSyncService(db).sync_customers()
    return AdminQuickBooksCustomerSyncResponse(
        synced_count=result.synced_count,
        created_count=result.created_count,
        updated_count=result.updated_count,
        inactive_count=result.inactive_count,
    )


@router.post("/sync-tax-codes", response_model=AdminQuickBooksTaxCodeSyncResponse)
def sync_quickbooks_tax_codes(
    db: Session = Depends(deps.get_db),
    current_user: AuthenticatedUser = Depends(deps.require_roles(UserRole.ADMIN)),
):
    _ = current_user
    result = QuickBooksTaxCodeSyncService(db).sync_tax_codes()
    return AdminQuickBooksTaxCodeSyncResponse(
        synced_count=result.synced_count,
        created_count=result.created_count,
        updated_count=result.updated_count,
        active_count=result.active_count,
        mapped_count=result.mapped_count,
        sales_tax_enabled=result.sales_tax_enabled,
    )
