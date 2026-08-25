-- ============================================================
-- BUSY UFO ERP - PRODUCTION PDC ATOMIC ACCOUNTING WORKFLOW
-- Migration: 003_pdc_atomic_accounting_workflow.sql
-- ============================================================

-- 1. Ensure busy_ufo_pdcs table and all required columns exist safely
CREATE TABLE IF NOT EXISTS busy_ufo_pdcs (
    id VARCHAR(50) PRIMARY KEY,
    request_id VARCHAR(100),
    company_id VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('RECEIVED', 'ISSUED')),
    party_id VARCHAR(50),
    party_type VARCHAR(20) CHECK (party_type IN ('CUSTOMER', 'SUPPLIER')),
    party_name VARCHAR(150),
    cheque_number VARCHAR(100) NOT NULL,
    bank_name VARCHAR(150),
    cleared_bank_name VARCHAR(150),
    cheque_date DATE NOT NULL,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'DEPOSITED', 'CLEARED', 'BOUNCED', 'CANCELLED', 'RETURNED')),
    reference_voucher_no VARCHAR(100),
    notes TEXT,
    cleared_at TIMESTAMP WITH TIME ZONE,
    deposit_date DATE,
    bounce_date DATE,
    bounce_reason TEXT,
    bounce_charges NUMERIC(12,2) DEFAULT 0.00,
    linked_journal_id VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ensure all columns exist on existing busy_ufo_pdcs tables
ALTER TABLE busy_ufo_pdcs ADD COLUMN IF NOT EXISTS request_id VARCHAR(100);
ALTER TABLE busy_ufo_pdcs ADD COLUMN IF NOT EXISTS company_id VARCHAR(50) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE busy_ufo_pdcs ADD COLUMN IF NOT EXISTS type VARCHAR(20);
ALTER TABLE busy_ufo_pdcs ADD COLUMN IF NOT EXISTS party_id VARCHAR(50);
ALTER TABLE busy_ufo_pdcs ADD COLUMN IF NOT EXISTS party_type VARCHAR(20);
ALTER TABLE busy_ufo_pdcs ADD COLUMN IF NOT EXISTS party_name VARCHAR(150);
ALTER TABLE busy_ufo_pdcs ADD COLUMN IF NOT EXISTS cheque_number VARCHAR(100);
ALTER TABLE busy_ufo_pdcs ADD COLUMN IF NOT EXISTS bank_name VARCHAR(150);
ALTER TABLE busy_ufo_pdcs ADD COLUMN IF NOT EXISTS cleared_bank_name VARCHAR(150);
ALTER TABLE busy_ufo_pdcs ADD COLUMN IF NOT EXISTS cheque_date DATE;
ALTER TABLE busy_ufo_pdcs ADD COLUMN IF NOT EXISTS amount NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE busy_ufo_pdcs ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'PENDING';
ALTER TABLE busy_ufo_pdcs ADD COLUMN IF NOT EXISTS reference_voucher_no VARCHAR(100);
ALTER TABLE busy_ufo_pdcs ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE busy_ufo_pdcs ADD COLUMN IF NOT EXISTS cleared_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE busy_ufo_pdcs ADD COLUMN IF NOT EXISTS deposit_date DATE;
ALTER TABLE busy_ufo_pdcs ADD COLUMN IF NOT EXISTS bounce_date DATE;
ALTER TABLE busy_ufo_pdcs ADD COLUMN IF NOT EXISTS bounce_reason TEXT;
ALTER TABLE busy_ufo_pdcs ADD COLUMN IF NOT EXISTS bounce_charges NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE busy_ufo_pdcs ADD COLUMN IF NOT EXISTS linked_journal_id VARCHAR(50);
ALTER TABLE busy_ufo_pdcs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pdc_request_id ON busy_ufo_pdcs(request_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pdc_company_status ON busy_ufo_pdcs(company_id, status);
CREATE INDEX IF NOT EXISTS idx_pdc_cheque_date ON busy_ufo_pdcs(cheque_date);
CREATE INDEX IF NOT EXISTS idx_pdc_party ON busy_ufo_pdcs(party_id);

-- 2. Ensure Journal Entries and Lines schema is complete and unified
CREATE TABLE IF NOT EXISTS busy_ufo_journal_entries (
    id VARCHAR(50) PRIMARY KEY,
    request_id VARCHAR(100),
    company_id VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    entry_number VARCHAR(50),
    voucher_no VARCHAR(50),
    voucher_type VARCHAR(50) DEFAULT 'JOURNAL',
    voucher_date DATE DEFAULT CURRENT_DATE,
    date DATE DEFAULT CURRENT_DATE,
    reference_type VARCHAR(50),
    reference_id VARCHAR(50),
    narration TEXT,
    notes TEXT,
    debit_total NUMERIC(12,2) DEFAULT 0.00,
    credit_total NUMERIC(12,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE busy_ufo_journal_entries ADD COLUMN IF NOT EXISTS request_id VARCHAR(100);
ALTER TABLE busy_ufo_journal_entries ADD COLUMN IF NOT EXISTS entry_number VARCHAR(50);
ALTER TABLE busy_ufo_journal_entries ADD COLUMN IF NOT EXISTS voucher_no VARCHAR(50);
ALTER TABLE busy_ufo_journal_entries ADD COLUMN IF NOT EXISTS voucher_type VARCHAR(50) DEFAULT 'JOURNAL';
ALTER TABLE busy_ufo_journal_entries ADD COLUMN IF NOT EXISTS voucher_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE busy_ufo_journal_entries ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;
ALTER TABLE busy_ufo_journal_entries ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50);
ALTER TABLE busy_ufo_journal_entries ADD COLUMN IF NOT EXISTS reference_id VARCHAR(50);
ALTER TABLE busy_ufo_journal_entries ADD COLUMN IF NOT EXISTS narration TEXT;
ALTER TABLE busy_ufo_journal_entries ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE busy_ufo_journal_entries ADD COLUMN IF NOT EXISTS debit_total NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE busy_ufo_journal_entries ADD COLUMN IF NOT EXISTS credit_total NUMERIC(12,2) DEFAULT 0.00;

CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_request_id ON busy_ufo_journal_entries(request_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_journal_company_date ON busy_ufo_journal_entries(company_id, voucher_date);

CREATE TABLE IF NOT EXISTS busy_ufo_journal_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_id VARCHAR(50) REFERENCES busy_ufo_journal_entries(id) ON DELETE CASCADE,
    entry_id VARCHAR(50),
    account_id VARCHAR(50),
    account_name VARCHAR(150),
    ledger_id VARCHAR(50),
    ledger_name VARCHAR(150),
    account_group VARCHAR(100) DEFAULT 'General',
    debit NUMERIC(12,2) DEFAULT 0.00,
    credit NUMERIC(12,2) DEFAULT 0.00,
    particulars TEXT
);

ALTER TABLE busy_ufo_journal_lines ADD COLUMN IF NOT EXISTS journal_id VARCHAR(50);
ALTER TABLE busy_ufo_journal_lines ADD COLUMN IF NOT EXISTS entry_id VARCHAR(50);
ALTER TABLE busy_ufo_journal_lines ADD COLUMN IF NOT EXISTS account_id VARCHAR(50);
ALTER TABLE busy_ufo_journal_lines ADD COLUMN IF NOT EXISTS account_name VARCHAR(150);
ALTER TABLE busy_ufo_journal_lines ADD COLUMN IF NOT EXISTS ledger_id VARCHAR(50);
ALTER TABLE busy_ufo_journal_lines ADD COLUMN IF NOT EXISTS ledger_name VARCHAR(150);
ALTER TABLE busy_ufo_journal_lines ADD COLUMN IF NOT EXISTS account_group VARCHAR(100) DEFAULT 'General';
ALTER TABLE busy_ufo_journal_lines ADD COLUMN IF NOT EXISTS debit NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE busy_ufo_journal_lines ADD COLUMN IF NOT EXISTS credit NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE busy_ufo_journal_lines ADD COLUMN IF NOT EXISTS particulars TEXT;

CREATE INDEX IF NOT EXISTS idx_jlines_journal ON busy_ufo_journal_lines(journal_id);
CREATE INDEX IF NOT EXISTS idx_jlines_entry ON busy_ufo_journal_lines(entry_id);

-- 3. RLS Security Policies for PDCs and Journals
ALTER TABLE busy_ufo_pdcs ENABLE ROW LEVEL SECURITY;
ALTER TABLE busy_ufo_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE busy_ufo_journal_lines ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'busy_ufo_pdcs' AND policyname = 'Allow all on busy_ufo_pdcs') THEN
        CREATE POLICY "Allow all on busy_ufo_pdcs" ON busy_ufo_pdcs FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'busy_ufo_journal_entries' AND policyname = 'Allow all on busy_ufo_journal_entries') THEN
        CREATE POLICY "Allow all on busy_ufo_journal_entries" ON busy_ufo_journal_entries FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'busy_ufo_journal_lines' AND policyname = 'Allow all on busy_ufo_journal_lines') THEN
        CREATE POLICY "Allow all on busy_ufo_journal_lines" ON busy_ufo_journal_lines FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;


-- ============================================================
-- 4. ATOMIC DATABASE RPCs FOR PDC WORKFLOW
-- ============================================================

-- RPC A: Record / Save PDC Idempotently
CREATE OR REPLACE FUNCTION save_pdc_rpc(
    p_request_id VARCHAR,
    p_company_id VARCHAR,
    p_type VARCHAR,
    p_party_id VARCHAR,
    p_party_type VARCHAR,
    p_party_name VARCHAR,
    p_cheque_number VARCHAR,
    p_bank_name VARCHAR,
    p_cheque_date DATE,
    p_amount NUMERIC,
    p_status VARCHAR DEFAULT 'PENDING',
    p_reference_voucher_no VARCHAR DEFAULT '',
    p_notes TEXT DEFAULT ''
) RETURNS JSONB AS $$
DECLARE
    v_existing JSONB;
    v_pdc_id VARCHAR;
    v_saved JSONB;
BEGIN
    -- Idempotency check
    SELECT row_to_json(p) INTO v_existing FROM busy_ufo_pdcs p WHERE request_id = p_request_id LIMIT 1;
    IF v_existing IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'is_duplicate', true, 'data', v_existing);
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Cheque amount must be greater than zero';
    END IF;

    v_pdc_id := 'pdc-' || EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::BIGINT || '-' || floor(random() * 1000)::TEXT;

    INSERT INTO busy_ufo_pdcs (
        id, request_id, company_id, type, party_id, party_type, party_name,
        cheque_number, bank_name, cheque_date, amount, status,
        reference_voucher_no, notes, created_at, updated_at
    ) VALUES (
        v_pdc_id, p_request_id, p_company_id, p_type, p_party_id, p_party_type, p_party_name,
        p_cheque_number, p_bank_name, p_cheque_date, p_amount, COALESCE(p_status, 'PENDING'),
        p_reference_voucher_no, p_notes, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    );

    SELECT row_to_json(p) INTO v_saved FROM busy_ufo_pdcs p WHERE id = v_pdc_id;
    RETURN jsonb_build_object('success', true, 'data', v_saved);
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Save PDC failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;


-- RPC B: Deposit PDC into Company Bank Account
CREATE OR REPLACE FUNCTION deposit_pdc_rpc(
    p_pdc_id VARCHAR,
    p_request_id VARCHAR,
    p_deposit_date DATE,
    p_bank_name VARCHAR,
    p_notes TEXT DEFAULT ''
) RETURNS JSONB AS $$
DECLARE
    v_pdc RECORD;
    v_saved JSONB;
BEGIN
    SELECT * INTO v_pdc FROM busy_ufo_pdcs WHERE id = p_pdc_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PDC record % not found', p_pdc_id;
    END IF;

    IF v_pdc.status = 'DEPOSITED' THEN
        SELECT row_to_json(p) INTO v_saved FROM busy_ufo_pdcs p WHERE id = p_pdc_id;
        RETURN jsonb_build_object('success', true, 'message', 'PDC is already marked as deposited', 'data', v_saved);
    END IF;

    IF v_pdc.status NOT IN ('PENDING') THEN
        RAISE EXCEPTION 'Cannot deposit PDC with status %', v_pdc.status;
    END IF;

    UPDATE busy_ufo_pdcs
    SET status = 'DEPOSITED',
        deposit_date = COALESCE(p_deposit_date, CURRENT_DATE),
        cleared_bank_name = COALESCE(p_bank_name, v_pdc.bank_name),
        notes = CASE WHEN p_notes <> '' THEN COALESCE(notes, '') || ' | ' || p_notes ELSE notes END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_pdc_id;

    SELECT row_to_json(p) INTO v_saved FROM busy_ufo_pdcs p WHERE id = p_pdc_id;
    RETURN jsonb_build_object('success', true, 'data', v_saved);
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Deposit PDC failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;


-- RPC C: Clear PDC (Atomic Balance Update & Journal Entry Generation)
CREATE OR REPLACE FUNCTION clear_pdc_rpc(
    p_pdc_id VARCHAR,
    p_request_id VARCHAR,
    p_cleared_date DATE,
    p_bank_ledger_id VARCHAR,
    p_bank_ledger_name VARCHAR,
    p_party_ledger_id VARCHAR,
    p_party_ledger_name VARCHAR
) RETURNS JSONB AS $$
DECLARE
    v_pdc RECORD;
    v_journal_id VARCHAR;
    v_voucher_no VARCHAR;
    v_clear_date DATE;
    v_party_name VARCHAR;
    v_bank_name VARCHAR;
    v_saved JSONB;
BEGIN
    SELECT * INTO v_pdc FROM busy_ufo_pdcs WHERE id = p_pdc_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PDC record % not found', p_pdc_id;
    END IF;

    IF v_pdc.status = 'CLEARED' THEN
        SELECT row_to_json(p) INTO v_saved FROM busy_ufo_pdcs p WHERE id = p_pdc_id;
        RETURN jsonb_build_object('success', true, 'message', 'PDC is already cleared', 'data', v_saved);
    END IF;

    IF v_pdc.status IN ('CANCELLED', 'RETURNED', 'BOUNCED') THEN
        RAISE EXCEPTION 'Cannot clear PDC in status %', v_pdc.status;
    END IF;

    v_clear_date := COALESCE(p_cleared_date, CURRENT_DATE);
    v_party_name := COALESCE(p_party_ledger_name, v_pdc.party_name, 'Party Account');
    v_bank_name := COALESCE(p_bank_ledger_name, v_pdc.cleared_bank_name, v_pdc.bank_name, 'Bank Account');

    -- Generate atomic journal voucher number
    v_voucher_no := get_next_document_number(v_pdc.company_id, 'JOURNAL', 'JV');
    v_journal_id := 'jv-pdc-' || EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::BIGINT || '-' || floor(random() * 1000)::TEXT;

    -- Insert Journal Entry Header
    INSERT INTO busy_ufo_journal_entries (
        id, request_id, company_id, entry_number, voucher_no, voucher_type,
        voucher_date, date, reference_type, reference_id,
        narration, notes, debit_total, credit_total, created_at
    ) VALUES (
        v_journal_id, 'req_jrn_pdc_clr_' || p_request_id, v_pdc.company_id, v_voucher_no, v_voucher_no, 'PDC',
        v_clear_date, v_clear_date, 'PDC_CLEARANCE', v_pdc.id,
        'PDC Cleared: Cheque #' || v_pdc.cheque_number || ' (' || v_party_name || ')',
        'PDC Cleared via ' || v_bank_name, v_pdc.amount, v_pdc.amount, CURRENT_TIMESTAMP
    );

    -- Insert Balanced Journal Lines & Update Master Balances
    IF v_pdc.type = 'RECEIVED' THEN
        -- Received PDC (Customer): Debit Bank Account, Credit Customer
        INSERT INTO busy_ufo_journal_lines (
            journal_id, entry_id, account_id, account_name, ledger_id, ledger_name, account_group, debit, credit, particulars
        ) VALUES
        (v_journal_id, v_journal_id, p_bank_ledger_id, v_bank_name, p_bank_ledger_id, v_bank_name, 'Bank Accounts', v_pdc.amount, 0.00, 'Cheque deposit & realization: #' || v_pdc.cheque_number),
        (v_journal_id, v_journal_id, v_pdc.party_id, v_party_name, v_pdc.party_id, v_party_name, 'Sundry Debtors', 0.00, v_pdc.amount, 'Customer payment realized: Cheque #' || v_pdc.cheque_number);

        -- Update customer outstanding balance
        IF v_pdc.party_id IS NOT NULL AND v_pdc.party_id <> '' THEN
            UPDATE busy_ufo_customers
            SET current_balance = current_balance - v_pdc.amount,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = v_pdc.party_id AND company_id = v_pdc.company_id;
        END IF;

    ELSE
        -- Issued PDC (Supplier): Debit Supplier, Credit Bank Account
        INSERT INTO busy_ufo_journal_lines (
            journal_id, entry_id, account_id, account_name, ledger_id, ledger_name, account_group, debit, credit, particulars
        ) VALUES
        (v_journal_id, v_journal_id, v_pdc.party_id, v_party_name, v_pdc.party_id, v_party_name, 'Sundry Creditors', v_pdc.amount, 0.00, 'Supplier payment settled: Cheque #' || v_pdc.cheque_number),
        (v_journal_id, v_journal_id, p_bank_ledger_id, v_bank_name, p_bank_ledger_id, v_bank_name, 'Bank Accounts', 0.00, v_pdc.amount, 'Bank disbursement: Cheque #' || v_pdc.cheque_number);

        -- Update supplier payable balance
        IF v_pdc.party_id IS NOT NULL AND v_pdc.party_id <> '' THEN
            UPDATE busy_ufo_suppliers
            SET current_balance = current_balance - v_pdc.amount,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = v_pdc.party_id AND company_id = v_pdc.company_id;
        END IF;
    END IF;

    -- Mark PDC as CLEARED
    UPDATE busy_ufo_pdcs
    SET status = 'CLEARED',
        cleared_at = CURRENT_TIMESTAMP,
        cleared_bank_name = v_bank_name,
        linked_journal_id = v_journal_id,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_pdc_id;

    SELECT row_to_json(p) INTO v_saved FROM busy_ufo_pdcs p WHERE id = p_pdc_id;
    RETURN jsonb_build_object(
        'success', true,
        'data', v_saved,
        'journal_id', v_journal_id,
        'voucher_no', v_voucher_no
    );
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'PDC clearance failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;


-- RPC D: Bounce PDC (Atomic Reversal if previously Cleared & Record Dishonor)
CREATE OR REPLACE FUNCTION bounce_pdc_rpc(
    p_pdc_id VARCHAR,
    p_request_id VARCHAR,
    p_bounce_date DATE,
    p_bank_ledger_id VARCHAR,
    p_bank_ledger_name VARCHAR,
    p_party_ledger_id VARCHAR,
    p_party_ledger_name VARCHAR,
    p_bounce_charges NUMERIC DEFAULT 0.00,
    p_notes TEXT DEFAULT ''
) RETURNS JSONB AS $$
DECLARE
    v_pdc RECORD;
    v_was_cleared BOOLEAN;
    v_journal_id VARCHAR;
    v_voucher_no VARCHAR;
    v_bounce_date DATE;
    v_party_name VARCHAR;
    v_bank_name VARCHAR;
    v_saved JSONB;
BEGIN
    SELECT * INTO v_pdc FROM busy_ufo_pdcs WHERE id = p_pdc_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PDC record % not found', p_pdc_id;
    END IF;

    IF v_pdc.status = 'BOUNCED' THEN
        SELECT row_to_json(p) INTO v_saved FROM busy_ufo_pdcs p WHERE id = p_pdc_id;
        RETURN jsonb_build_object('success', true, 'message', 'PDC is already marked as bounced', 'data', v_saved);
    END IF;

    v_was_cleared := (v_pdc.status = 'CLEARED');
    v_bounce_date := COALESCE(p_bounce_date, CURRENT_DATE);
    v_party_name := COALESCE(p_party_ledger_name, v_pdc.party_name, 'Party Account');
    v_bank_name := COALESCE(p_bank_ledger_name, v_pdc.cleared_bank_name, v_pdc.bank_name, 'Bank Account');

    -- If cheque was already cleared, create atomic reversal journal voucher and re-instate customer/supplier balance
    IF v_was_cleared THEN
        v_voucher_no := get_next_document_number(v_pdc.company_id, 'JOURNAL', 'JV');
        v_journal_id := 'jv-pdc-rev-' || EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::BIGINT || '-' || floor(random() * 1000)::TEXT;

        INSERT INTO busy_ufo_journal_entries (
            id, request_id, company_id, entry_number, voucher_no, voucher_type,
            voucher_date, date, reference_type, reference_id,
            narration, notes, debit_total, credit_total, created_at
        ) VALUES (
            v_journal_id, 'req_jrn_pdc_rev_' || p_request_id, v_pdc.company_id, v_voucher_no, v_voucher_no, 'PDC',
            v_bounce_date, v_bounce_date, 'PDC_BOUNCE_REVERSAL', v_pdc.id,
            'REVERSAL: Cheque #' || v_pdc.cheque_number || ' Bounced / Dishonored (' || v_party_name || ')',
            COALESCE(p_notes, 'Dishonored Cheque Reversal'), v_pdc.amount, v_pdc.amount, CURRENT_TIMESTAMP
        );

        IF v_pdc.type = 'RECEIVED' THEN
            -- Reverse customer receipt: Debit Customer, Credit Bank
            INSERT INTO busy_ufo_journal_lines (
                journal_id, entry_id, account_id, account_name, ledger_id, ledger_name, account_group, debit, credit, particulars
            ) VALUES
            (v_journal_id, v_journal_id, v_pdc.party_id, v_party_name, v_pdc.party_id, v_party_name, 'Sundry Debtors', v_pdc.amount, 0.00, 'Re-instate customer balance for bounced cheque #' || v_pdc.cheque_number),
            (v_journal_id, v_journal_id, p_bank_ledger_id, v_bank_name, p_bank_ledger_id, v_bank_name, 'Bank Accounts', 0.00, v_pdc.amount, 'Reversal of cleared funds: Cheque #' || v_pdc.cheque_number);

            IF v_pdc.party_id IS NOT NULL AND v_pdc.party_id <> '' THEN
                UPDATE busy_ufo_customers
                SET current_balance = current_balance + v_pdc.amount,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = v_pdc.party_id AND company_id = v_pdc.company_id;
            END IF;
        ELSE
            -- Reverse supplier payment: Debit Bank, Credit Supplier
            INSERT INTO busy_ufo_journal_lines (
                journal_id, entry_id, account_id, account_name, ledger_id, ledger_name, account_group, debit, credit, particulars
            ) VALUES
            (v_journal_id, v_journal_id, p_bank_ledger_id, v_bank_name, p_bank_ledger_id, v_bank_name, 'Bank Accounts', v_pdc.amount, 0.00, 'Reversal of supplier payment cheque #' || v_pdc.cheque_number),
            (v_journal_id, v_journal_id, v_pdc.party_id, v_party_name, v_pdc.party_id, v_party_name, 'Sundry Creditors', 0.00, v_pdc.amount, 'Re-instate supplier payable for bounced cheque #' || v_pdc.cheque_number);

            IF v_pdc.party_id IS NOT NULL AND v_pdc.party_id <> '' THEN
                UPDATE busy_ufo_suppliers
                SET current_balance = current_balance + v_pdc.amount,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = v_pdc.party_id AND company_id = v_pdc.company_id;
            END IF;
        END IF;
    END IF;

    -- Update PDC Status to BOUNCED
    UPDATE busy_ufo_pdcs
    SET status = 'BOUNCED',
        bounce_date = v_bounce_date,
        bounce_reason = COALESCE(p_notes, 'Dishonored by Bank'),
        bounce_charges = COALESCE(p_bounce_charges, 0.00),
        linked_journal_id = COALESCE(v_journal_id, linked_journal_id),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_pdc_id;

    SELECT row_to_json(p) INTO v_saved FROM busy_ufo_pdcs p WHERE id = p_pdc_id;
    RETURN jsonb_build_object(
        'success', true,
        'data', v_saved,
        'was_cleared_reversal', v_was_cleared,
        'journal_id', v_journal_id
    );
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'PDC bounce failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;


-- RPC E: Cancel or Return PDC
CREATE OR REPLACE FUNCTION cancel_pdc_rpc(
    p_pdc_id VARCHAR,
    p_request_id VARCHAR,
    p_reason TEXT DEFAULT '',
    p_is_returned BOOLEAN DEFAULT FALSE
) RETURNS JSONB AS $$
DECLARE
    v_pdc RECORD;
    v_target_status VARCHAR;
    v_saved JSONB;
BEGIN
    SELECT * INTO v_pdc FROM busy_ufo_pdcs WHERE id = p_pdc_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PDC record % not found', p_pdc_id;
    END IF;

    IF v_pdc.status = 'CLEARED' THEN
        RAISE EXCEPTION 'Cannot cancel or return a CLEARED cheque. Bounce/reverse it first.';
    END IF;

    v_target_status := CASE WHEN p_is_returned THEN 'RETURNED' ELSE 'CANCELLED' END;

    UPDATE busy_ufo_pdcs
    SET status = v_target_status,
        notes = CASE WHEN p_reason <> '' THEN COALESCE(notes, '') || ' | ' || p_reason ELSE notes END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_pdc_id;

    SELECT row_to_json(p) INTO v_saved FROM busy_ufo_pdcs p WHERE id = p_pdc_id;
    RETURN jsonb_build_object('success', true, 'data', v_saved);
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'PDC cancellation failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;
