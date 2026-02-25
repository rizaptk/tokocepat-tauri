# 🍲 SPRINT 6-A – F&B Ingredient & Recipe Reporting (In Progress)

🎯 **Goal:** Implement an ingredient-based inventory system for F&B products and create a dedicated report for tracking raw material consumption and waste.

---

### Execution Plan

#### 1️⃣ Database & Schema Foundation
- [x] Define a new database schema for `RawIngredients` (e.g., Coffee Beans, Milk, Sugar) including fields for `name`, `unit_type` (gram, ml, pcs), `stock_qty`, and `cost_per_unit`.
- [x] Create a corresponding service (`ingredientService.ts`) for all `RawIngredient` CRUD operations.
- [ ] Define a new schema for `Recipes` that links a "Composite Product" (like Cappuccino) to a list of `RawIngredients` and the quantity of each required for one serving.
- [ ] Create a `recipeService.ts` for managing recipe data.

#### 2️⃣ Product Management UI Enhancements
- [x] Create a new UI at `/product` for managing all raw materials (as a new tab).
- [ ] In the "Add/Edit Product" form for 'Food & Beverage' items, add a "Composite Product" toggle.
- [ ] When "Composite Product" is enabled:
    - [ ] Disable direct stock tracking for the finished product.
    - [ ] Display a new "Recipe" section where a user can add ingredients from the `RawIngredients` list and specify the quantity needed for one unit of the finished product.

#### 3️⃣ Transaction & Stock Logic Integration
- [ ] In the `transactionService`, when a "Composite Product" is sold, modify the logic to:
    - [ ] Look up the product's recipe.
    - [ ] For each ingredient in the recipe, deduct the specified amount from the `RawIngredients` stock.
    - [ ] Create corresponding `StockMovements` records for each ingredient deduction, linking back to the sale transaction.
- [ ] In the `stockService`, update the manual adjustment form to also support adjustments for `RawIngredients`.

#### 4️⃣ F&B Consumption Report
- [ ] Create a new report page at `/dashboard/reports/consumption`.
- [ ] This report will allow filtering by date range.
- [ ] It will display a list of all raw ingredients and show:
    - [ ] Opening stock for the period.
    - [ ] Total consumed in sales.
    - [ ] Total adjusted (waste, restock).
    - [ ] Closing stock.
- [ ] Add a visualization (e.g., a pie chart) showing the cost breakdown of the most-consumed ingredients.

---

### Definition of Done
- [ ] Users can create and manage raw ingredients and link them to finished F&B products via a recipe.
- [ ] Selling a composite product correctly deducts stock from the associated ingredients.
- [ ] A new consumption report provides a clear audit trail of all ingredient usage, adjustments, and current levels.
- [ ] The system accurately tracks the cost of goods sold for composite products based on their ingredients.
