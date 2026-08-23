-- ============================================================
-- BUSY UFO ERP - ATOMIC NUMBERING & IDEMPOTENCY HARDENING MIGRATION
-- ============================================================

-- 1. Document Sequences Table for Atomic Concurrency-Safe Numbering
CREATE TABLE IF NOT EXISTS document_sequences (
    company_id VARCHAR(50) NOT NULL,
    doc_type VARCHAR(50) NOT NULL,
    prefix VARCHAR(20) NOT NULL,
    year_val INT NOT NULL,
    next_val INT NOT NULL DEFAULT 1001,
    PRIMARY KEY (company_id, doc_type, year_val)
);

-- 2. Atomic Document Number Generation Function with Row Locking
CREATE OR REPLACE FUNCTION get_next_document_number(
    p_company_id VARCHAR,
    p_doc_type VARCHAR,
    p_prefix VARCHAR
) RETURNS VARCHAR AS $$
DECLARE
    v_year INT;
    v_next INT;
    v_result VARCHAR;
BEGIN
    v_year := EXTRACT(YEAR FROM CURRENT_DATE);
    
    INSERT INTO document_sequences (company_id, doc_type, prefix, year_val, next_val)
    VALUES (p_company_id, p_doc_type, p_prefix, v_year, 1001)
    ON CONFLICT (company_id, doc_type, year_val) DO NOTHING;
    
    SELECT next_val INTO v_next
    FROM document_sequences
    WHERE company_id = p_company_id AND doc_type = p_doc_type AND year_val = v_year
    FOR UPDATE;
    
    UPDATE document_sequences
    SET next_val = next_val + 1
    WHERE company_id = p_company_id AND doc_type = p_doc_type AND year_val = v_year;
    
    v_result := p_prefix || '-' || v_year || '-' || LPAD(v_next::TEXT, 4, '0');
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- 3. RPC Wrappers for Sales and Purchases
CREATE OR REPLACE FUNCTION generate_next_sales_invoice_number_rpc(p_company_id VARCHAR) 
RETURNS VARCHAR AS $$
BEGIN
    RETURN get_next_document_number(p_company_id, 'SALE', 'INV');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_next_purchase_number_rpc(p_company_id VARCHAR) 
RETURNS VARCHAR AS $$
BEGIN
    RETURN get_next_document_number(p_company_id, 'PURCHASE', 'PUR');
END;
$$ LANGUAGE plpgsql;

-- 4. Ensure request_id columns exist across transaction tables safely
ALTER TABLE busy_ufo_sales ADD COLUMN IF NOT EXISTS request_id VARCHAR(100);
ALTER TABLE busy_ufo_purchases ADD COLUMN IF NOT EXISTS request_id VARCHAR(100);
ALTER TABLE busy_ufo_customer_receipts ADD COLUMN IF NOT EXISTS request_id VARCHAR(100);
ALTER TABLE busy_ufo_supplier_payments ADD COLUMN IF NOT EXISTS request_id VARCHAR(100);
ALTER TABLE busy_ufo_expenses ADD COLUMN IF NOT EXISTS request_id VARCHAR(100);

-- Add unique indexes on request_id where non-null to enforce database idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_request_id ON busy_ufo_sales(request_id) WHERE request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_request_id ON busy_ufo_purchases(request_id) WHERE request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_receipts_request_id ON busy_ufo_customer_receipts(request_id) WHERE request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_request_id ON busy_ufo_supplier_payments(request_id) WHERE request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_request_id ON busy_ufo_expenses(request_id) WHERE request_id IS NOT NULL;
