CREATE TABLE IF NOT EXISTS quickbooks_tax_codes (
    id UUID PRIMARY KEY,
    realm_id VARCHAR(64) NOT NULL,
    qb_tax_code_id VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    internal_tax_code VARCHAR(32),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT quickbooks_tax_codes_realm_qb_tax_code_id_uq UNIQUE (realm_id, qb_tax_code_id)
);

CREATE INDEX IF NOT EXISTS quickbooks_tax_codes_realm_id_idx
ON quickbooks_tax_codes (realm_id);

CREATE INDEX IF NOT EXISTS quickbooks_tax_codes_internal_tax_code_idx
ON quickbooks_tax_codes (internal_tax_code);
