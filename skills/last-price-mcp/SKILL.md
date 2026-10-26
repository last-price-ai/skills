---
name: last-price-mcp
description: Use when the Last Price MCP connector is available and the task is any last-price.ai job (compute, verify, functions, routing, guardrails, experiments, learned pricing, Rosetta, commerce, order-to-cash, webhooks, billing, team, marketplace, offers, spend policy). Maps jobs to tool names and explains keyless demo fallback and credential setup.
---
# Last Price: using the MCP connector

- Endpoint (install/reconnect): `https://api.last-price.ai/api/mcp/rpc`. Discovery: `https://api.last-price.ai/.well-known/mcp.json`.
- The connector exposes roughly 300 tools and grows often. Always list the live tools (and read the full schema of the one you call) before calling; treat the map below as a guide, not a frozen schema.
- Credential: set `LASTPRICE_API_KEY` in the connector config (an `lp_...` key). Without one, the compute/verify tools silently run the **public demo** (one pinned function, `metadata` and constraints dropped, elasticity assumed -1.2). Read `_lastprice_notice` on every response and label demo results as demo.
- Many tools state "Needs a claimed workspace": a self-registered sandbox key gets 403 until a person claims it (see `last-price-auth`).

## Tool map by job

**Price**
- `pricing_conversation` (prepare is free and keyless: returns the questions to ask; then resend `continuation.request` + answers), `compute_price`, `compute_prices_batch` (up to 100), `verify_price`, `list_verification_strategies`, `run_pricing_chain`, `report_outcome`, `verify_signed_quote`, `read_quote_reply` (reads a buyer's reply to a quote: accept, too high, counter, question, decline).
- From a photo, link, PDF, barcode or description: `price_from_capture`, `describe_item_so_far` (while the person is still typing), `list_price_checks`, `get_price_check`, `report_problem` (the person says a price or answer is wrong).
- `run_reference_pipeline` runs one of the seven reference pipelines without a key (10 per hour per IP; 501 `pipeline_execution_unavailable` while its flag is off).

**Functions and routing**
- `list_functions`, `get_function`, `create_function`, `update_function`, `delete_function`, `test_function`, `get_function_health`, `run_function_health_probe`.
- `list_routing_policies`, `get_routing_policy`, `create_routing_policy`, `update_routing_policy`, `delete_routing_policy`, `get_learned_routing`, `get_prompt_class_benchmarks`, `list_pricing_pipelines`, `list_vendor_adapters`.
- Guardrails: `get_price_guardrails`, `set_price_guardrails` (replaces the whole set), `delete_price_guardrails`. Channel rates: `get_channel_rates`, `set_channel_rates`.

**Experiments**
- `list_experiments`, `create_experiment`, `get_experiment_definition`, `get_experiment_results`, `get_experiment_stopping`, `set_experiment_bandit`, `propose_experiment_variant`, `check_variant_significance`, `allocate_variant_traffic`, `recommend_jale_price`.

**Learning loop and analyst**
- `get_pricing_analysis` (free findings), `get_analyst_brief`, `ask_pricing_analyst`, `get_analyst_settings`, `set_analyst_settings`, `apply_analyst_proposal`.
- `get_learned_pricing`, `set_learned_pricing`, `get_learned_elasticity_curve`, `list_learned_price_changes`, `decide_learned_price_change`, `get_price_exploration`, `set_price_exploration`.
- Buyer-aware and hosted models: `get_buyer_aware_pricing`, `set_buyer_aware_pricing`, `get_feature_contract`, `set_feature_contract`, `infer_feature_contract`, `delete_feature_contract`, `list_hosted_models`, `create_hosted_model`, `get_hosted_model`, `train_hosted_model`, `upload_hosted_model_version`, `predict_with_hosted_model`, `promote_hosted_model_version`, `rollback_hosted_model`, `get_forge_status`, `reject_forge_candidate`, `get_frontier_model`, `suggest_frontier_price`, `list_product_categories`, `set_product_category`.
- Data exchange: `contribute_price_data`, `contribute_price_data_batch`, `list_jale_contributions`, `get_jale_token_balance`, `query_jale_pool` (each query spends tokens).

**Rosetta**
- `get_rosetta_health`, `list_canonical_schemas` (both public), `ingest_with_rosetta`, `plan_rosetta_mapping`, `translate_with_rosetta`, `freeze_rosetta_adapter`, `normalize_with_rosetta`, `list_rosetta_review`, `decide_rosetta_review`.

**Commerce pipeline**
- `list_commerce_connectors`, `create_commerce_connector`, `set_commerce_connector_active`, `sync_commerce_connector`, `sync_commerce_orders`, `list_commerce_catalog`, `list_commerce_observations`, `add_commerce_observation`, `list_commerce_policies`, `get_commerce_policy`, `create_commerce_policy`, `update_commerce_policy`, `delete_commerce_policy`, `test_commerce_policy`, `run_commerce_cycle`, `list_commerce_proposals`, `approve_commerce_proposal`, `reject_commerce_proposal`, `execute_commerce_proposals` (changes live store prices), `list_commerce_audit_events`, `seed_commerce_sample`.
- Hosted price scraping (501 `hosted_scraping_not_enabled` until its release flag is on for the workspace): `preview_scrape_job` (try selectors, stores nothing), `create_scrape_job`, `list_scrape_jobs`, `update_scrape_job` (`enabled: false` pauses), `run_scrape_job`, `list_scrape_job_runs`, `delete_scrape_job` (also deletes run history).

**Order to cash**
- Customers, contacts, orders: `list_customers`, `get_customer`, `get_customer_by_external_id`, `create_customer`, `update_customer`, `delete_customer`, `list_contacts`, `get_contact`, `get_contact_by_external_id`, `create_contact`, `update_contact`, `delete_contact`, `list_orders`, `get_order`, `create_order`, `update_order`, `delete_order`, `add_order_line`, `list_order_lines`, `activate_order`.
- Payments, disputes, invoices, credits, costs: `list_payments`, `get_payment`, `create_payment`, `refund_payment`, `list_disputes`, `get_dispute`, `create_dispute`, `update_dispute`, `list_invoices`, `get_invoice`, `create_invoice`, `update_invoice`, `delete_invoice`, `send_invoice` (sends a real email), `list_credits`, `get_credit`, `create_credit`, `delete_credit`, `get_credit_balance`, `list_costs`, `record_cost`, `get_cost_analytics`.
- Monetization (early access): credit bundles `list_credit_bundle_plans`, `create_credit_bundle_plan`, `update_credit_bundle_plan`, `grant_credit_bundle_plan` (adds credits and drafts an invoice), `list_credit_bundle_subscriptions`, `cancel_credit_bundle_subscription`; tax preview `calculate_tax` (saves nothing); Stripe `get_stripe_connection`, `issue_invoice_with_stripe` (bills the customer on Stripe); integration code `generate_monetization_code` (writes nothing), `get_github_app_connection`, `open_monetization_pull_request` (opens a PR in the workspace's own repo, never merges).

**Usage, receipts, billing**
- `get_usage`, `get_usage_breakdown`, `list_usage_events`, `get_llm_usage`, `list_llm_usage_events`, `get_receipt`, `list_receipts`, `get_billing_settings`, `update_billing_settings`, `list_outcomes`, `top_up_balance`, `create_card_topup`, `get_card_topup`, `list_day_passes`, `buy_day_pass`, `get_wallet_balance`, `get_x402_price_index`.

**Marketplace**
- `browse_catalog`, `list_marketplace_listings` (public), `list_my_marketplace_listings`, `create_marketplace_listing`, `update_marketplace_listing`, `delete_marketplace_listing`, `get_function_review`, `run_function_review`, `get_public_leaderboard`, `discover_offers`, `get_marketplace_earnings`, payout runs (`request_payout_run`, `list_payout_runs`, `get_payout_run`, `approve_payout_run`, `reject_payout_run`, `retry_payout_run`, `get_payout_schedule`, `set_payout_schedule`).

**Webhooks, notifications, approvals, audit**
- `list_webhooks`, `create_webhook`, `update_webhook`, `delete_webhook`, `ping_webhook`, `list_webhook_deliveries`, `verify_webhook_signature`.
- `list_notifications`, `mark_notifications_read`, `get_alert_preferences`, `update_alert_preferences`, `list_approvals`, `get_approval`, `decide_approval`, `list_audit_events`.

**Workspace, team, agents**
- `get_workspace_settings`, `update_workspace_settings`, `list_team_members`, `add_team_member`, `change_team_member_role`, `remove_team_member`, `invite_team_member`, `list_invitations`, `revoke_invitation` (team tools need an `x-api-key` with `team:admin`), `list_inference_providers`, `list_connected_apps`, `disconnect_connected_app`.
- Self-hosted inference sidecar (AITune): `list_aitune_backends`, `start_aitune_profiling`, `get_aitune_profiling`, `get_aitune_system_stats`.
- Agents: `get_agent_capabilities`, `get_agent_value_receipt`, `estimate_task_cost`, `read_my_inbox`, `get_agent_behaviour_tests`, `run_agent_behaviour_tests`, `get_agent_behaviour_test_run`, `get_agent_protocol`, `set_agent_protocol`, `verify_agent_protocol`.

**Buyer agents: spend policy and offers**
- Spend control: `get_spend_policy`, `set_spend_policy`, `check_purchase`, `confirm_purchase`, `settle_purchase`, `reconcile_purchase`, `get_purchase_intent`, `open_spend_session`, `draw_session_spend`, `settle_session_draw`, `get_spend_session`, `close_spend_session`.
- Negotiation: sellers use `get_offer_settings`, `set_offer_settings`, `set_offer_product`, `remove_offer_product`, `preview_offer`, `list_negotiations`; buyers use `get_offer_terms`, `make_offer`, `get_negotiation`, `accept_counter` (commits the buyer).

**UCP and storefronts**
- `get_ucp_profile` (public), `get_ucp_quote`, `create_ucp_checkout`, `get_ucp_checkout`, `list_ucp_checkouts`, `update_ucp_checkout`, `complete_ucp_checkout`, `cancel_ucp_checkout`.
- Storefronts (early access): `list_storefronts`, `create_storefront`, `get_storefront`, `update_storefront`, `delete_storefront`, domain tools (`search_storefront_domains`, `quote_storefront_domain`, `list_storefront_domain_quotes`, `add_storefront_domain`, `verify_storefront_domain`, `remove_storefront_domain`, `list_storefront_dns_records`, `add_storefront_dns_record`, `remove_storefront_dns_record`), `check_agent_readiness`.

**Discovery and help**
- Staff-only launch tools (`list_feature_launches`, `get_feature_launch_plan`) are for Last Price staff; ignore them.
- `get_changelog`, `list_reels`, `get_reel`, `list_demo_apps`, `simulate_agent_cut`, `get_cut_advisor_settings`.

## Common flows

- **Quote with missing inputs:** `pricing_conversation` prepare, ask the user the returned questions, resend with answers, then compute.
- **Quote, then learn:** `compute_price` (keep `receipt.id`), later `report_outcome` with what really happened.
- **Workspace health check:** `get_pricing_analysis`, `get_price_guardrails`, `get_usage`, `list_notifications`, `list_approvals`.
- **Tighten guardrails safely:** `get_price_guardrails`, merge the change, `set_price_guardrails` with every rule, read back.

## Rules

- Tools that change live prices, money, access, or delete data (`set_price_guardrails`, `update_function` status, `execute_commerce_proposals`, `update_billing_settings`, `top_up_balance`, `buy_day_pass`, `refund_payment`, `send_invoice`, `issue_invoice_with_stripe`, `grant_credit_bundle_plan`, `cancel_credit_bundle_subscription`, `open_monetization_pull_request`, `approve_payout_run`, `accept_counter`, every `delete_*`): read current state first, confirm with the user, verify after.
- A tool that "returns payment requirements" without a payment spends nothing; never fabricate a payment signature.
- Report numbers verbatim with their period; never invent prices, findings, ids, or verdicts.
