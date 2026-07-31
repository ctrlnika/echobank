ALTER TABLE public.payees ADD COLUMN IF NOT EXISTS account_number text NOT NULL DEFAULT '00000000';
UPDATE public.payees SET account_number = lpad(regexp_replace(id::text, '\D', '', 'g'), 8, '0')::text;
UPDATE public.payees SET account_number = substr(account_number, 1, 4) || last4;

ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS account_number text NOT NULL DEFAULT '00000000';
UPDATE public.accounts SET account_number = lpad(regexp_replace(id::text, '\D', '', 'g'), 8, '0')::text;
UPDATE public.accounts SET account_number = substr(account_number, 1, 4) || last4;