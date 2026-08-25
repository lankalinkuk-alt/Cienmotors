-- ============================================================
-- MIGRATION 004: ATOMIC DOCUMENT COUNTERS & CONCURRENCY-SAFE RPCs
-- Safe, Non-Destructive Production Hardening for ERP
-- NO MAX()+1 at runtime. Concurrency-safe atomic counter table.
-- ============================================================

-- 1. Create Dedicated Document Counters Table
CREATE TABLE IF NOT EXISTS busy_ufo_document_counters (
    company_id VARCHAR(50) NOT NULL,
    document_type VARCHAR(30) NOT NULL,
    financial_year VARCHAR(10) NOT NULL,
    prefix VARCHAR(15) NOT NULL,
    last_number INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (company_id, document_type, financial_year)
);

-- 2. Ensure request_id & paid_to exist on expenses and transaction tables
ALTER TABLE IF EXISTS busy_ufo_expenses ADD COLUMN IF NOT EXISTS paid_to VARCHAR(150);
ALTER TABLE IF EXISTS busy_ufo_expenses ADD COLUMN IF NOT EXISTS request_id VARCHAR(100);
ALTER TABLE IF EXISTS busy_ufo_sales ADD COLUMN IF NOT EXISTS request_id VARCHAR(100);
ALTER TABLE IF EXISTS busy_ufo_purchases ADD COLUMN IF NOT EXISTS request_id VARCHAR(100);
ALTER TABLE IF EXISTS busy_ufo_customer_receipts ADD COLUMN IF NOT EXISTS request_id VARCHAR(100);
ALTER TABLE IF EXISTS busy_ufo_supplier_payments ADD COLUMN IF NOT EXISTS request_id VARCHAR(100);

-- 3. Idempotency Unique Indexes on request_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_request_id ON busy_ufo_sales(request_id) WHERE request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_request_id ON busy_ufo_purchases(request_id) WHERE request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_receipts_request_id ON busy_ufo_customer_receipts(request_id) WHERE request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_request_id ON busy_ufo_supplier_payments(request_id) WHERE request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_request_id ON busy_ufo_expenses(request_id) WHERE request_id IS NOT NULL;

-- 4. Document-Level Unique Indexes per Company
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_company_invoice ON busy_ufo_sales (company_id, invoice_number) WHERE invoice_number IS NOT NULL AND invoice_number <> '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_company_purchase ON busy_ufo_purchases (company_id, purchase_number) WHERE purchase_number IS NOT NULL AND purchase_number <> '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_receipts_company_receipt ON busy_ufo_customer_receipts (company_id, receipt_number) WHERE receipt_number IS NOT NULL AND receipt_number <> '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_company_payment ON busy_ufo_supplier_payments (company_id, payment_number) WHERE payment_number IS NOT NULL AND payment_number <> '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_company_expense ON busy_ufo_expenses (company_id, expense_number) WHERE expense_number IS NOT NULL AND expense_number <> '';

-- 5. Safe One-Time Initial Counter Seeding from Existing Documents
-- (Calculates initial baseline once during migration; runtime uses ONLY atomic increments)
INSERT INTO busy_ufo_document_counters (company_id, document_type, financial_year, prefix, last_number, updated_at)
SELECT 
    s.company_id,
    'SALE' AS document_type,
    TO_CHAR(COALESCE(s.invoice_date, CURRENT_DATE), 'YYYY') AS financial_year,
    'INV' AS prefix,
    MAX(
        CASE 
            WHEN s.invoice_number ~ '[0-9]+$' THEN (SUBSTRING(s.invoice_number FROM '[0-9]+$'))::INTEGER 
            ELSE 0 
        END
    ) AS last_number,
    CURRENT_TIMESTAMP
FROM busy_ufo_sales s
WHERE s.company_id IS NOT NULL AND s.company_id <> ''
GROUP BY s.company_id, TO_CHAR(COALESCE(s.invoice_date, CURRENT_DATE), 'YYYY')
ON CONFLICT (company_id, document_type, financial_year)
DO UPDATE SET last_number = GREATEST(busy_ufo_document_counters.last_number, EXCLUDED.last_number);

INSERT INTO busy_ufo_document_counters (company_id, document_type, financial_year, prefix, last_number, updated_at)
SELECT 
    p.company_id,
    'PURCHASE' AS document_type,
    TO_CHAR(COALESCE(p.purchase_date, CURRENT_DATE), 'YYYY') AS financial_year,
    'PUR' AS prefix,
    MAX(
        CASE 
            WHEN p.purchase_number ~ '[0-9]+$' THEN (SUBSTRING(p.purchase_number FROM '[0-9]+$'))::INTEGER 
            ELSE 0 
        END
    ) AS last_number,
    CURRENT_TIMESTAMP
FROM busy_ufo_purchases p
WHERE p.company_id IS NOT NULL AND p.company_id <> ''
GROUP BY p.company_id, TO_CHAR(COALESCE(p.purchase_date, CURRENT_DATE), 'YYYY')
ON CONFLICT (company_id, document_type, financial_year)
DO UPDATE SET last_number = GREATEST(busy_ufo_document_counters.last_number, EXCLUDED.last_number);

INSERT INTO busy_ufo_document_counters (company_id, document_type, financial_year, prefix, last_number, updated_at)
SELECT 
    r.company_id,
    'RECEIPT' AS document_type,
    TO_CHAR(COALESCE(r.date, CURRENT_DATE), 'YYYY') AS financial_year,
    'REC' AS prefix,
    MAX(
        CASE 
            WHEN r.receipt_number ~ '[0-9]+$' THEN (SUBSTRING(r.receipt_number FROM '[0-9]+$'))::INTEGER 
            ELSE 0 
        END
    ) AS last_number,
    CURRENT_TIMESTAMP
FROM busy_ufo_customer_receipts r
WHERE r.company_id IS NOT NULL AND r.company_id <> ''
GROUP BY r.company_id, TO_CHAR(COALESCE(r.date, CURRENT_DATE), 'YYYY')
ON CONFLICT (company_id, document_type, financial_year)
DO UPDATE SET last_number = GREATEST(busy_ufo_document_counters.last_number, EXCLUDED.last_number);

INSERT INTO busy_ufo_document_counters (company_id, document_type, financial_year, prefix, last_number, updated_at)
SELECT 
    p.company_id,
    'PAYMENT' AS document_type,
    TO_CHAR(COALESCE(p.date, CURRENT_DATE), 'YYYY') AS financial_year,
    'PAY' AS prefix,
    MAX(
        CASE 
            WHEN p.payment_number ~ '[0-9]+$' THEN (SUBSTRING(p.payment_number FROM '[0-9]+$'))::INTEGER 
            ELSE 0 
        END
    ) AS last_number,
    CURRENT_TIMESTAMP
FROM busy_ufo_supplier_payments p
WHERE p.company_id IS NOT NULL AND p.company_id <> ''
GROUP BY p.company_id, TO_CHAR(COALESCE(p.date, CURRENT_DATE), 'YYYY')
ON CONFLICT (company_id, document_type, financial_year)
DO UPDATE SET last_number = GREATEST(busy_ufo_document_counters.last_number, EXCLUDED.last_number);

INSERT INTO busy_ufo_document_counters (company_id, document_type, financial_year, prefix, last_number, updated_at)
SELECT 
    e.company_id,
    'EXPENSE' AS document_type,
    TO_CHAR(COALESCE(e.date, CURRENT_DATE), 'YYYY') AS financial_year,
    'EXP' AS prefix,
    MAX(
        CASE 
            WHEN e.expense_number ~ '[0-9]+$' THEN (SUBSTRING(e.expense_number FROM '[0-9]+$'))::INTEGER 
            ELSE 0 
        END
    ) AS last_number,
    CURRENT_TIMESTAMP
FROM busy_ufo_expenses e
WHERE e.company_id IS NOT NULL AND e.company_id <> ''
GROUP BY e.company_id, TO_CHAR(COALESCE(e.date, CURRENT_DATE), 'YYYY')
ON CONFLICT (company_id, document_type, financial_year)
DO UPDATE SET last_number = GREATEST(busy_ufo_document_counters.last_number, EXCLUDED.last_number);


-- 6. Core Atomic Number Allocator Function (NO MAX+1 at runtime)
CREATE OR REPLACE FUNCTION allocate_document_number_atomic(
    p_company_id VARCHAR,
    p_doc_type VARCHAR,
    p_prefix VARCHAR,
    p_doc_date DATE DEFAULT CURRENT_DATE
) RETURNS VARCHAR AS $$
DECLARE
    v_fin_year VARCHAR(10);
    v_next_num INTEGER;
    v_result VARCHAR(50);
BEGIN
    -- Determine financial year from document date or current date
    v_fin_year := TO_CHAR(COALESCE(p_doc_date, CURRENT_DATE), 'YYYY');

    -- Atomic row-lock UPSERT and increment
    INSERT INTO busy_ufo_document_counters (company_id, document_type, financial_year, prefix, last_number, updated_at)
    VALUES (p_company_id, p_doc_type, v_fin_year, p_prefix, 1, CURRENT_TIMESTAMP)
    ON CONFLICT (company_id, document_type, financial_year)
    DO UPDATE SET 
        last_number = busy_ufo_document_counters.last_number + 1,
        updated_at = CURRENT_TIMESTAMP
    RETURNING last_number INTO v_next_num;

    v_result := p_prefix || '-' || v_fin_year || '-' || LPAD(v_next_num::TEXT, 4, '0');
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- 7. Legacy get_next_document_number compatibility redirect
CREATE OR REPLACE FUNCTION get_next_document_number(
    p_company_id VARCHAR,
    p_doc_type VARCHAR,
    p_prefix VARCHAR
) RETURNS VARCHAR AS $$
BEGIN
    RETURN allocate_document_number_atomic(p_company_id, p_doc_type, p_prefix, CURRENT_DATE);
END;
$$ LANGUAGE plpgsql;

-- 8. Standalone RPCs for Single Document Number Queries
CREATE OR REPLACE FUNCTION generate_next_sales_invoice_number_rpc(p_company_id VARCHAR) 
RETURNS VARCHAR AS $$
BEGIN
    RETURN allocate_document_number_atomic(p_company_id, 'SALE', 'INV', CURRENT_DATE);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_next_purchase_number_rpc(p_company_id VARCHAR) 
RETURNS VARCHAR AS $$
BEGIN
    RETURN allocate_document_number_atomic(p_company_id, 'PURCHASE', 'PUR', CURRENT_DATE);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_next_receipt_number_rpc(p_company_id VARCHAR) 
RETURNS VARCHAR AS $$
BEGIN
    RETURN allocate_document_number_atomic(p_company_id, 'RECEIPT', 'REC', CURRENT_DATE);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_next_payment_number_rpc(p_company_id VARCHAR) 
RETURNS VARCHAR AS $$
BEGIN
    RETURN allocate_document_number_atomic(p_company_id, 'PAYMENT', 'PAY', CURRENT_DATE);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_next_expense_number_rpc(p_company_id VARCHAR) 
RETURNS VARCHAR AS $$
BEGIN
    RETURN allocate_document_number_atomic(p_company_id, 'EXPENSE', 'EXP', CURRENT_DATE);
END;
$$ LANGUAGE plpgsql;


-- 9. Complete Atomic Sales Invoice Posting RPC
CREATE OR REPLACE FUNCTION post_sale_invoice_rpc(
    p_request_id VARCHAR,
    p_company_id VARCHAR,
    p_customer_id VARCHAR,
    p_customer_name VARCHAR,
    p_sale_type VARCHAR,
    p_invoice_date DATE,
    p_total_amount NUMERIC,
    p_overall_discount NUMERIC,
    p_grand_total NUMERIC,
    p_paid_amount NUMERIC,
    p_due_amount NUMERIC,
    p_notes TEXT,
    p_items JSONB
) RETURNS JSONB AS $$
DECLARE
    v_invoice_number VARCHAR(50);
    v_sale_id VARCHAR(100);
    v_item JSONB;
    v_existing_sale JSONB;
BEGIN
    -- 1. Idempotency Check on request_id
    SELECT row_to_json(s) INTO v_existing_sale FROM busy_ufo_sales s WHERE request_id = p_request_id LIMIT 1;
    IF v_existing_sale IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'is_duplicate', true, 'data', v_existing_sale);
    END IF;

    -- 2. Concurrency-safe atomic number allocation
    v_invoice_number := allocate_document_number_atomic(p_company_id, 'SALE', 'INV', p_invoice_date);
    v_sale_id := 'sale-' || EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::BIGINT || '-' || floor(random() * 1000)::TEXT;

    -- 3. Insert Invoice Header
    INSERT INTO busy_ufo_sales (
        id, request_id, invoice_number, invoice_date, customer_id, customer_name,
        sale_type, total_amount, overall_discount, grand_total, paid_amount, due_amount,
        payment_status, company_id, notes
    ) VALUES (
        v_sale_id, p_request_id, v_invoice_number, p_invoice_date, p_customer_id, p_customer_name,
        p_sale_type, p_total_amount, p_overall_discount, p_grand_total, p_paid_amount, p_due_amount,
        CASE WHEN p_due_amount <= 0 THEN 'PAID' WHEN p_paid_amount > 0 THEN 'PARTIAL' ELSE 'UNPAID' END,
        p_company_id, p_notes
    );

    -- 4. Insert Items & Decrement Inventory
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO busy_ufo_sale_items (
            invoice_id, product_id, product_code, product_name, quantity, unit_price, discount, discount_type, total
        ) VALUES (
            v_sale_id, v_item->>'productId', v_item->>'productCode', v_item->>'productName',
            (v_item->>'quantity')::NUMERIC, (v_item->>'unitPrice')::NUMERIC,
            COALESCE((v_item->>'discount')::NUMERIC, 0), COALESCE(v_item->>'discountType', 'PERCENT'), (v_item->>'total')::NUMERIC
        );

        -- Stock deduction
        UPDATE busy_ufo_products 
        SET current_stock = current_stock - (v_item->>'quantity')::NUMERIC,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = v_item->>'productId' AND company_id = p_company_id;
    END LOOP;

    -- 5. Update Customer Balance
    IF p_customer_id IS NOT NULL AND p_customer_id <> '' AND p_due_amount > 0 THEN
        UPDATE busy_ufo_customers
        SET current_balance = current_balance + p_due_amount,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = p_customer_id AND company_id = p_company_id;
    END IF;

    -- Return the saved row
    SELECT row_to_json(s) INTO v_existing_sale FROM busy_ufo_sales s WHERE id = v_sale_id;
    RETURN jsonb_build_object('success', true, 'data', v_existing_sale);
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Sale posting failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;


-- 10. Complete Atomic Purchase Invoice Posting RPC
CREATE OR REPLACE FUNCTION post_purchase_invoice_rpc(
    p_request_id VARCHAR,
    p_company_id VARCHAR,
    p_supplier_id VARCHAR,
    p_supplier_name VARCHAR,
    p_purchase_type VARCHAR,
    p_purchase_date DATE,
    p_total_amount NUMERIC,
    p_overall_discount NUMERIC,
    p_grand_total NUMERIC,
    p_paid_amount NUMERIC,
    p_due_amount NUMERIC,
    p_notes TEXT,
    p_items JSONB
) RETURNS JSONB AS $$
DECLARE
    v_purchase_number VARCHAR(50);
    v_purchase_id VARCHAR(100);
    v_item JSONB;
    v_existing JSONB;
BEGIN
    SELECT row_to_json(p) INTO v_existing FROM busy_ufo_purchases p WHERE request_id = p_request_id LIMIT 1;
    IF v_existing IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'is_duplicate', true, 'data', v_existing);
    END IF;

    v_purchase_number := allocate_document_number_atomic(p_company_id, 'PURCHASE', 'PUR', p_purchase_date);
    v_purchase_id := 'pur-' || EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::BIGINT || '-' || floor(random() * 1000)::TEXT;

    INSERT INTO busy_ufo_purchases (
        id, request_id, purchase_number, purchase_date, supplier_id, supplier_name,
        purchase_type, total_amount, overall_discount, grand_total, paid_amount, due_amount,
        payment_status, company_id, notes
    ) VALUES (
        v_purchase_id, p_request_id, v_purchase_number, p_purchase_date, p_supplier_id, p_supplier_name,
        p_purchase_type, p_total_amount, p_overall_discount, p_grand_total, p_paid_amount, p_due_amount,
        CASE WHEN p_due_amount <= 0 THEN 'PAID' WHEN p_paid_amount > 0 THEN 'PARTIAL' ELSE 'UNPAID' END,
        p_company_id, p_notes
    );

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO busy_ufo_purchase_items (
            purchase_id, product_id, product_code, product_name, quantity, unit_cost, discount, discount_type, total
        ) VALUES (
            v_purchase_id, v_item->>'productId', v_item->>'productCode', v_item->>'productName',
            (v_item->>'quantity')::NUMERIC, (v_item->>'unitCost')::NUMERIC,
            COALESCE((v_item->>'discount')::NUMERIC, 0), COALESCE(v_item->>'discountType', 'PERCENT'), (v_item->>'total')::NUMERIC
        );

        UPDATE busy_ufo_products 
        SET current_stock = current_stock + (v_item->>'quantity')::NUMERIC,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = v_item->>'productId' AND company_id = p_company_id;
    END LOOP;

    IF p_supplier_id IS NOT NULL AND p_supplier_id <> '' AND p_due_amount > 0 THEN
        UPDATE busy_ufo_suppliers
        SET current_balance = current_balance + p_due_amount,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = p_supplier_id AND company_id = p_company_id;
    END IF;

    SELECT row_to_json(p) INTO v_existing FROM busy_ufo_purchases p WHERE id = v_purchase_id;
    RETURN jsonb_build_object('success', true, 'data', v_existing);
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Purchase posting failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;


-- 11. Atomic Customer Receipt Posting RPC
CREATE OR REPLACE FUNCTION post_customer_receipt_rpc(
    p_request_id VARCHAR,
    p_company_id VARCHAR,
    p_customer_id VARCHAR,
    p_customer_name VARCHAR,
    p_date DATE,
    p_amount NUMERIC,
    p_payment_method VARCHAR,
    p_reference_no VARCHAR,
    p_notes TEXT
) RETURNS JSONB AS $$
DECLARE
    v_receipt_number VARCHAR(50);
    v_receipt_id VARCHAR(100);
    v_existing JSONB;
BEGIN
    SELECT row_to_json(r) INTO v_existing FROM busy_ufo_customer_receipts r WHERE request_id = p_request_id LIMIT 1;
    IF v_existing IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'is_duplicate', true, 'data', v_existing);
    END IF;

    v_receipt_number := allocate_document_number_atomic(p_company_id, 'RECEIPT', 'REC', p_date);
    v_receipt_id := 'rec-' || EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::BIGINT || '-' || floor(random() * 1000)::TEXT;

    INSERT INTO busy_ufo_customer_receipts (
        id, request_id, receipt_number, date, customer_id, customer_name,
        amount, payment_method, reference_no, notes, company_id
    ) VALUES (
        v_receipt_id, p_request_id, v_receipt_number, p_date, p_customer_id, p_customer_name,
        p_amount, p_payment_method, p_reference_no, p_notes, p_company_id
    );

    IF p_customer_id IS NOT NULL AND p_customer_id <> '' THEN
        UPDATE busy_ufo_customers
        SET current_balance = GREATEST(0, current_balance - p_amount),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = p_customer_id AND company_id = p_company_id;
    END IF;

    SELECT row_to_json(r) INTO v_existing FROM busy_ufo_customer_receipts r WHERE id = v_receipt_id;
    RETURN jsonb_build_object('success', true, 'data', v_existing);
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Customer receipt posting failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;


-- 12. Atomic Supplier Payment Posting RPC
CREATE OR REPLACE FUNCTION post_supplier_payment_rpc(
    p_request_id VARCHAR,
    p_company_id VARCHAR,
    p_supplier_id VARCHAR,
    p_supplier_name VARCHAR,
    p_date DATE,
    p_amount NUMERIC,
    p_payment_method VARCHAR,
    p_reference_no VARCHAR,
    p_notes TEXT
) RETURNS JSONB AS $$
DECLARE
    v_payment_number VARCHAR(50);
    v_payment_id VARCHAR(100);
    v_existing JSONB;
BEGIN
    SELECT row_to_json(p) INTO v_existing FROM busy_ufo_supplier_payments p WHERE request_id = p_request_id LIMIT 1;
    IF v_existing IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'is_duplicate', true, 'data', v_existing);
    END IF;

    v_payment_number := allocate_document_number_atomic(p_company_id, 'PAYMENT', 'PAY', p_date);
    v_payment_id := 'pay-' || EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::BIGINT || '-' || floor(random() * 1000)::TEXT;

    INSERT INTO busy_ufo_supplier_payments (
        id, request_id, payment_number, date, supplier_id, supplier_name,
        amount, payment_method, reference_no, notes, company_id
    ) VALUES (
        v_payment_id, p_request_id, v_payment_number, p_date, p_supplier_id, p_supplier_name,
        p_amount, p_payment_method, p_reference_no, p_notes, p_company_id
    );

    IF p_supplier_id IS NOT NULL AND p_supplier_id <> '' THEN
        UPDATE busy_ufo_suppliers
        SET current_balance = GREATEST(0, current_balance - p_amount),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = p_supplier_id AND company_id = p_company_id;
    END IF;

    SELECT row_to_json(p) INTO v_existing FROM busy_ufo_supplier_payments p WHERE id = v_payment_id;
    RETURN jsonb_build_object('success', true, 'data', v_existing);
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Supplier payment posting failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;


-- 13. Atomic Expense Posting RPC
CREATE OR REPLACE FUNCTION post_expense_rpc(
    p_request_id VARCHAR,
    p_company_id VARCHAR,
    p_date DATE,
    p_category VARCHAR,
    p_amount NUMERIC,
    p_paid_to VARCHAR,
    p_payment_method VARCHAR,
    p_notes TEXT
) RETURNS JSONB AS $$
DECLARE
    v_expense_number VARCHAR(50);
    v_expense_id VARCHAR(100);
    v_existing JSONB;
BEGIN
    SELECT row_to_json(e) INTO v_existing FROM busy_ufo_expenses e WHERE request_id = p_request_id LIMIT 1;
    IF v_existing IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'is_duplicate', true, 'data', v_existing);
    END IF;

    v_expense_number := allocate_document_number_atomic(p_company_id, 'EXPENSE', 'EXP', p_date);
    v_expense_id := 'exp-' || EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::BIGINT || '-' || floor(random() * 1000)::TEXT;

    INSERT INTO busy_ufo_expenses (
        id, request_id, expense_number, date, category, amount,
        paid_to, payment_method, notes, company_id
    ) VALUES (
        v_expense_id, p_request_id, v_expense_number, p_date, p_category, p_amount,
        p_paid_to, p_payment_method, p_notes, p_company_id
    );

    SELECT row_to_json(e) INTO v_existing FROM busy_ufo_expenses e WHERE id = v_expense_id;
    RETURN jsonb_build_object('success', true, 'data', v_existing);
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Expense posting failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;
