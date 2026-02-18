# Database Setup Instructions

The application is now fully migrated to Supabase. To fix the "API server down" or "Table not found" errors, you must initialize the database schema.

## Step 1: Open Supabase Project

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your project.
3. Keep this page open.

## Step 2: Run the SQL Schema

1. In the Supabase dashboard sidebar, click on the **SQL Editor** icon (looks like `>_`).
2. Click **New Query**.
3. Copy the entire contents of the file `supabase-schema.sql` from your project root.
4. Paste it into the SQL Editor.
5. Click **Run** (bottom right).

## Step 3: Verify Tables

1. Go to the **Table Editor** (looks like a table grid icon) in the sidebar.
2. You should now see tables like `reports`, `profiles`, `config`, etc.

## Step 4: Restart Development Server

1. Stop your local server if running.
2. Run `npm run dev:netlify` (or `netlify dev`) to restart.
3. Refresh the application page.

The error "Could not find the table 'public.reports'" confirms that the application is correctly trying to reach Supabase, but the tables have not been created yet. Running the SQL script will fix this.
