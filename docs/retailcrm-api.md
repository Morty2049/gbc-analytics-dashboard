# RetailCRM API v5 — Reference (extract)

Source: https://help.retailcrm.ru/api_v5_ru.html

## Base URL
`https://{store-domain}/api/v5/{endpoint}`

## Auth
- API key per request: `apiKey` query/header param
- Verify access: `GET /api/api-versions`, `GET /api/credentials`
- Permissions are scoped (e.g. `order_read`, `order_write`)

## Orders

### Create single order
- `POST /api/v5/orders/create`
- Body (form-encoded `order=<json>`):
  - `order.number`, `order.externalId`
  - `order.customer.{id|externalId}` (or inline firstName/lastName/phone/email)
  - `order.orderProducts[]` with `quantity` and product ref
  - `order.delivery`, `order.customFields`, `order.status`, `order.orderType`, `order.orderMethod`

### Batch upload (max 50)
- `POST /api/v5/orders/upload`
- Body: `orders=<json array>` (same structure as create)

### List orders
- `GET /api/v5/orders`
- Query: `limit` ∈ {20,50,100}, `page`, `filter[...]`
- Response paginated: `pagination.{limit,totalCount,currentPage,totalPageCount}`

## Webhooks (notifications about new orders)
- Configured in admin UI: Settings → Integration → API → "Уведомления" / via integration module
- Subscribe to events: `order` (create/update). RetailCRM POSTs JSON to your URL.
- Alternative for MVP: poll `GET /api/v5/orders?filter[createdAtFrom]=...` on a schedule.

## Response shape
```json
{ "success": true, "id": 123, ... }
```

## Notes for this project
- The mock_orders.json schema (firstName/lastName/phone/items[].productName/initialPrice/delivery.address/customFields)
  matches inline-customer + orderProducts shape — usable directly with `/orders/create` or `/orders/upload`.
- Items use `initialPrice` and `productName` (free-text) — no catalog SKU required.
