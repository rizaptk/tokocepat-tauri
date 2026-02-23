# 🛍 SPRINT 3 – Cart Engine & Modifier Logic

🎯 **Goal:** Implement a fast, feature-rich cart system, including pending carts and complex product options.

---

### Execution Plan

#### 1️⃣ Core Cart Functionality
- [ ] Refactor the cart state management from React Context to Zustand for better performance and scalability.
- [ ] Implement "Hold to Edit" functionality on cart items to allow cashiers to quickly change quantity.
- [ ] Implement "Swipe to Delete" gesture on cart items for rapid removal.
- [ ] Ensure all cart calculations (subtotal, tax, total) are automatically updated in real-time via the Zustand store.

#### 2️⃣ Variant & Modifier Flow
- [ ] Create a modal that automatically appears when a product with `has_variant: true` is added to the cart.
- [ ] In the modal, allow users to select a product variant, which then overrides the base price.
- [ ] Develop a similar modal for products with `has_modifier: true`.
- [ ] Implement validation logic within the modifier modal to enforce `min_select` and `max_select` rules.
- [ ] The final price of a cart item must correctly calculate `Base Price + Variant Price + Sum(Modifier Prices)`.

#### 3️⃣ Pending Cart System
- [ ] Add a "Park Cart" button to the cart interface, allowing a transaction to be saved for later.
- [ ] Implement the service logic to save the current cart state to the `Cart` and `CartItems` tables in the database.
- [ ] Create a new UI view where the cashier can see a list of all pending carts.
- [ ] Implement functionality to "Resume" a pending cart, loading its contents back into the active cart state and deleting the pending record.

---

### Definition of Done
- [ ] The cart's state is stable, managed entirely by Zustand, with no calculation errors.
- [ ] The price of items with variants and modifiers is calculated correctly.
- [ ] The full "park and resume" pending cart workflow is functional and reliable.
- [ ] UI interactions for adding, editing, and removing items are fast and intuitive.