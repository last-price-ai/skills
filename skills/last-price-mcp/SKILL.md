---
name: last-price-mcp
description: Use when the Last Price MCP connector is available and the task is any last-price.ai job (compute, verify, functions, routing, guardrails, experiments, learned pricing, Rosetta, commerce, order-to-cash, webhooks, billing, team, marketplace, offers). Maps jobs to tool names and explains keyless demo fallback and credential setup.
---
# Last Price: using the MCP connector

- Endpoint (install/reconnect): `https://api.last-price.ai/api/mcp/rpc?profile=directory`. This skill pack covers the directory tool set, which leaves out payments, wallets and payouts. Discovery: `https://api.last-price.ai/.well-known/mcp.json`.
- The connector exposes roughly 260 tools and grows often. Always list the live tools (and read the full schema of the one you call) before calling; treat the map below as a guide, not a frozen schema.
- Credential: set `LASTPRICE_API_KEY` in the connector config (an `lp_...` key). Without one, the compute/verify tools silently run the **public demo** (one pinned function, `metadata` and constraints dropped, elasticity assumed -1.2). Read `_lastprice_notice` on every response and label demo results as demo.
- Many tools state "Needs a claimed workspace": a self-registered sandbox key gets 403 until a person claims it (see `last-price-auth`).

## Tool map by job

**Price**
- `pricing_conversation` (prepare is free and keyless: returns the questions to ask; then resend `continuation.request` + answers), `compute_price`, `compute_prices_batch` (up to 100), `verify_price`, `list_verification_strategies`, `run_pricing_chain`, `report_outcome`, `verify_signed_quote`, `read_quote_reply` (reads a buyer's reply to a quote: accept, too high, counter, question, decline).
- From a photo, link, PDF, barcode or description: `price_from_capture`, `describe_item_so_far` (while the person is still typing), `list_price_checks`, `get_price_check`, `report_problem` (the person says a price or answer is wrong).
- `run_reference_pipeline` runs one of the seven reference pipelines without a key (10 per hour per IP; 501 `pipeline_execution_unavailable` while its flag is off).

**Functions and routing**
- `list_functions`, `get_function`, `create_function`, `update_function`, `delete_function`, `test_function`, `get_function_health`, `run_function_health_probe`.
- `list_routing_policies`, `get_routing_policy`, `create_routing_policy`, `update_routing_policy`, `delete_routing_policy`, `get_learned_routing`, `get_prompt_class_benchmarks`, `list_pricing_pipelines`, `list_vendor_adapters`, `preview_price_change` (replays a price change on past calls; changes nothing).
- Guardrails: `get_price_guardrails`, `set_price_guardrails` (replaces the whole set), `delete_price_guardrails`. Channel rates: `get_channel_rates`, `set_channel_rates`.

**Experiments**
- `list_experiments`, `create_experiment`, `get_experiment_definition`, `get_experiment_results`, `get_experiment_stopping`, `set_experiment_bandit`, `propose_experiment_variant`, `check_variant_significance`, `allocate_variant_traffic`, `recommend_jale_price`, `set_experiment_status`, `delete_experiment`, `remove_experiment_conversions`.

**Learning loop and analyst**
- `get_pricing_analysis` (free findings), `get_analyst_brief`, `ask_pricing_analyst`, `get_analyst_settings`, `set_analyst_settings`, `apply_analyst_proposal`.
- `get_learned_pricing`, `set_learned_pricing`, `get_learned_elasticity_curve`, `list_learned_price_changes`, `decide_learned_price_change`, `get_price_exploration`, `set_price_exploration`.
- Buyer-aware and hosted models: `get_buyer_aware_pricing`, `set_buyer_aware_pricing`, `get_feature_contract`, `set_feature_contract`, `infer_feature_contract`, `delete_feature_contract`, `list_hosted_models`, `create_hosted_model`, `get_hosted_model`, `train_hosted_model`, `upload_hosted_model_version`, `predict_with_hosted_model`, `promote_hosted_model_version`, `rollback_hosted_model`, `get_forge_status`, `reject_forge_candidate`, `promote_forge_candidate` (changes live prices), `retire_forge_candidate`, `get_price_foundation_report`, `get_frontier_model`, `suggest_frontier_price`, `list_product_categories`, `set_product_category`.
- Data exchange: `contribute_price_data`, `contribute_price_data_batch`, `list_jale_contributions`, `get_jale_token_balance`, `query_jale_pool` (each query spends tokens).

**Rosetta**
- `get_rosetta_health`, `list_canonical_schemas` (both public), `ingest_with_rosetta`, `plan_rosetta_mapping`, `translate_with_rosetta`, `freeze_rosetta_adapter`, `normalize_with_rosetta`, `list_rosetta_review`, `decide_rosetta_review`, `list_rosetta_adapters`, `revoke_rosetta_adapter`.

**Commerce pipeline**
- `list_commerce_connectors`, `create_commerce_connector`, `check_commerce_connector` (tries a store, stores nothing), `set_commerce_connector_active`, `sync_commerce_connector`, `sync_commerce_orders`, `list_commerce_catalog`, `list_commerce_observations`, `add_commerce_observation`, `list_commerce_policies`, `get_commerce_policy`, `create_commerce_policy`, `update_commerce_policy`, `delete_commerce_policy`, `test_commerce_policy`, `run_commerce_cycle`, `list_commerce_proposals`, `approve_commerce_proposal`, `reject_commerce_proposal`, `execute_commerce_proposals` (changes live store prices), `list_commerce_audit_events`, `seed_commerce_sample`.
- Hosted price scraping (501 `hosted_scraping_not_enabled` until its release flag is on for the workspace): `preview_scrape_job` (try selectors, stores nothing), `create_scrape_job`, `list_scrape_jobs`, `update_scrape_job` (`enabled: false` pauses), `run_scrape_job`, `list_scrape_job_runs`, `delete_scrape_job` (also deletes run history).

**Order to cash**
- Customers, contacts, orders: `list_customers`, `get_customer`, `get_customer_by_external_id`, `create_customer`, `update_customer`, `delete_customer`, `list_contacts`, `get_contact`, `get_contact_by_external_id`, `create_contact`, `update_contact`, `delete_contact`, `list_orders`, `get_order`, `create_order`, `update_order`, `delete_order`, `add_order_line`, `list_order_lines`, `activate_order`.
- Payments, disputes, invoices, credits, costs: `list_payments`, `get_payment`, `create_payment`, `refund_payment`, `list_disputes`, `get_dispute`, `create_dispute`, `update_dispute`, `list_invoices`, `get_invoice`, `create_invoice`, `update_invoice`, `delete_invoice`, `send_invoice` (sends a real email), `list_credits`, `get_credit`, `create_credit`, `delete_credit`, `get_credit_balance`, `list_costs`, `record_cost`, `get_cost_analytics`.
- Monetization (early access): credit bundles `list_credit_bundle_plans`, `create_credit_bundle_plan`, `update_credit_bundle_plan`, `grant_credit_bundle_plan` (adds credits and drafts an invoice), `list_credit_bundle_subscriptions`, `cancel_credit_bundle_subscription`; tax preview `calculate_tax` (saves nothing); Stripe `get_stripe_connection`, `issue_invoice_with_stripe` (bills the customer on Stripe); integration code `generate_monetization_code` (writes nothing), `get_github_app_connection`, `open_monetization_pull_request` (opens a PR in the workspace's own repo, never merges).

**Usage, receipts, billing**
- `get_usage`, `get_usage_breakdown`, `list_usage_events`, `get_llm_usage`, `list_llm_usage_events`, `get_receipt`, `list_receipts`.

**Marketplace**
- `browse_catalog`, `list_marketplace_listings` (public), `list_my_marketplace_listings`, `create_marketplace_listing`, `update_marketplace_listing`, `delete_marketplace_listing`, `get_function_review`, `run_function_review`, `get_public_leaderboard`, `get_marketplace_earnings`.

**Webhooks, notifications, approvals, audit**
- `list_webhooks`, `create_webhook`, `update_webhook`, `delete_webhook`, `ping_webhook`, `list_webhook_deliveries`, `verify_webhook_signature`, `rotate_webhook_secret` (the old secret stops verifying).
- `list_approvals`, `get_approval`, `decide_approval`, `list_audit_events`.

**Workspace, team, agents**
- Workspace settings, team and notifications are managed in the dashboard (`https://app.last-price.ai`). Connected apps: `list_connected_apps`, `disconnect_connected_app`. Child keys for sub-agents: `mint_child_key`, `revoke_child_key`. Partner workspaces: `get_partner_allowance`, `list_partner_workspaces`, `create_partner_workspace`.
- Self-hosted inference sidecar (AITune): `list_aitune_backends`, `start_aitune_profiling`, `get_aitune_profiling`, `get_aitune_system_stats`.
- Agents: `get_agent_capabilities`, `get_agent_value_receipt`, `estimate_task_cost`, `get_agent_behaviour_tests`, `run_agent_behaviour_tests`, `get_agent_behaviour_test_run`, `get_agent_protocol`, `set_agent_protocol`, `verify_agent_protocol`.

**Offers**
- Negotiation: sellers use `get_offer_settings`, `set_offer_settings`, `set_offer_product`, `remove_offer_product`, `preview_offer`, `list_negotiations`; buyers use `get_offer_terms`, `make_offer`, `get_negotiation`, `accept_counter` (commits the buyer).
- Handover (a page for someone else's business): `fill_handover_sheet`, `create_handover_business`, `update_handover_business`, `publish_handover_business`, `get_handover_pack`, `list_handover_businesses`, `get_handover_business`; buyers with no key: `get_handover_page`, `order_from_handover_business` (records an order, moves no money).

**UCP and storefronts**
- `get_ucp_profile` (public), `get_ucp_quote`, `create_ucp_checkout`, `get_ucp_checkout`, `list_ucp_checkouts`, `update_ucp_checkout`, `complete_ucp_checkout`, `cancel_ucp_checkout`.
- Storefronts (early access): `list_storefronts`, `create_storefront`, `get_storefront`, `update_storefront`, `delete_storefront`, domain tools (`search_storefront_domains`, `quote_storefront_domain`, `list_storefront_domain_quotes`, `add_storefront_domain`, `verify_storefront_domain`, `remove_storefront_domain`, `list_storefront_dns_records`, `add_storefront_dns_record`, `remove_storefront_dns_record`), `check_agent_readiness`.

**Discovery and help**
- `get_changelog`, `list_demo_apps`, `simulate_agent_cut`, `get_cut_advisor_settings`.

## Common flows

- **Quote with missing inputs:** `pricing_conversation` prepare, ask the user the returned questions, resend with answers, then compute.
- **Quote, then learn:** `compute_price` (keep `receipt.id`), later `report_outcome` with what really happened.
- **Workspace health check:** `get_pricing_analysis`, `get_price_guardrails`, `get_usage`, `list_approvals`.
- **Tighten guardrails safely:** `get_price_guardrails`, merge the change, `set_price_guardrails` with every rule, read back.

## Rules

- Tools that change live prices, money, access, or delete data (`set_price_guardrails`, `update_function` status, `execute_commerce_proposals`, `refund_payment`, `send_invoice`, `issue_invoice_with_stripe`, `grant_credit_bundle_plan`, `cancel_credit_bundle_subscription`, `open_monetization_pull_request`, `accept_counter`, `promote_forge_candidate`, `retire_forge_candidate`, `set_experiment_status` (completed is final), `revoke_rosetta_adapter`, `remove_experiment_conversions`, `rotate_webhook_secret`, `revoke_child_key`, every `delete_*`): read current state first, confirm with the user, verify after.
- These tools never pay anyone: `create_payment` and `refund_payment` only record, `issue_invoice_with_stripe` sends an invoice the customer pays. Never fabricate a payment signature.
- Report numbers verbatim with their period; never invent prices, findings, ids, or verdicts.
