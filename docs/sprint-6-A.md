# 🍲 SPRINT 6-A – F&B Ingredient & Recipe Reporting (Completed)

🎯 **Goal:** Implement an ingredient-based inventory system for F&B products and create a dedicated report for tracking raw material consumption and waste.

---

### Execution Plan

#### 1️⃣ Database & Schema Foundation
- [x] Define a new database schema for `RawIngredients` (e.g., Coffee Beans, Milk, Sugar) including fields for `name`, `unit_type` (gram, ml, pcs), `stock_qty`, and `cost_per_unit`.
- [x] Create a corresponding service (`ingredientService.ts`) for all `RawIngredient` CRUD operations.
- [x] Define a new schema for `Recipes` that links a "Composite Product" (like Cappuccino) to a list of `RawIngredients` and the quantity of each required for one serving.
- [x] Create a `recipeService.ts` for managing recipe data.

#### 2️⃣ Product Management UI Enhancements
- [x] Create a new UI at `/product` for managing all raw materials (as a new tab).
- [x] In the "Add/Edit Product" form for 'Food & Beverage' items, add a "Composite Product" toggle.
- [x] When "Composite Product" is enabled:
    - [x] Disable direct stock tracking for the finished product.
    - [x] Display a new "Recipe" section where a user can add ingredients from the `RawIngredients` list and specify the quantity needed for one unit of the finished product.

#### 3️⃣ Transaction & Stock Logic Integration
- [x] In the `transactionService`, when a "Composite Product" is sold, modify the logic to:
    - [x] Look up the product's recipe.
    - [x] For each ingredient in the recipe, deduct the specified amount from the `RawIngredients` stock.
    - [x] Create corresponding `StockMovements` records for each ingredient deduction, linking back to the sale transaction.
- [x] In the `stockService`, update the manual adjustment form to also support adjustments for `RawIngredients`.

#### 4️⃣ F&B Consumption Report
- [x] Create a new report page at `/dashboard/reports/consumption`.
- [x] This report will allow filtering by date range.
- [x] It will display a list of all raw ingredients and show:
    - [x] Opening stock for the period.
    - [x] Total consumed in sales.
    - [x] Total adjusted (waste, restock).
    - [x] Closing stock.
- [s] Add a visualization (e.g., a pie chart) showing the cost breakdown of the most-consumed ingredients. (Skipped to prioritize core reporting features).

---

### Definition of Done
- [x] Users can create and manage raw ingredients and link them to finished F&B products via a recipe.
- [x] Selling a composite product correctly deducts stock from the associated ingredients.
- [x] A new consumption report provides a clear audit trail of all ingredient usage, adjustments, and current levels.
- [x] The system accurately tracks the cost of goods sold for composite products based on their ingredients.
