# **App Name**: ACS ProjectFlow

## Core Features:

- Kanban Board: Kanban board with drag-and-drop functionality, columns for To-Do, Ongoing, Done, and Blocked.
- Role-Based Access: Role-based access control for Employees (edit assigned tasks), Managers (add projects/tasks, view all), and Owners (financial summaries placeholder).
- Real-Time Sync: Real-time synchronization of task updates and comments across all users.

## Style Guidelines:

- Primary Color: Soft blue `#E9F2FF` for background and accents.
- Secondary Colors: Light gray `#F4F5F7` (column backgrounds), Mid gray `#DFE1E6` (borders, lines), Dark gray `#172B4D` (text headers), Yellow `#FFAB00` and Red `#DE350B` used as status markers.
- Accent Color: Vibrant blue `#0052CC` for active elements, buttons, highlights.
- Sans-serif font (like Inter, Helvetica, or Roboto) with font weight varying from regular (400) for body to semibold (600) for headers.
- Clear text hierarchy with medium to small font sizes.
- Multi-column layout using cards in a flex/grid layout.
- Generous padding and margins between elements (16–24px). Columns/cards have rounded corners (8px) and subtle shadows.
- Page uses a max-width fluid layout with side navigation and top bar. Sticky/fixed side and top navs with flat styling.
- Flat, minimal, and monochrome or soft-colored icons.
- Minimal visual noise, with smooth transitions and clean status indicators.

## Original User Request:
Create a web-based Project Management & Accountability Tool tailored for ACS a screen sales/installation company. Start with Phase 1 features:

Core Kanban Board:

Columns: To-Do, Ongoing, Done, Blocked.

Drag-and-drop task cards with details: *Title, Due Date (e.g., L2-5 OCT), Priority (Low/Medium/High), Assignee, Comments, Attachments*.

Role-Based Access Control:

Employees: Edit assigned tasks only by drag and drop into columns, and edit some fields in the task form.

Managers: Add projects, add tasks per project, view all projects and tasks and team members.

Owners: Access financial summaries (placeholder for Phase 3).

Real-Time Sync: Ensure all changes (task moves, comments) update instantly across users.

Basic UI Framework:
Left sidebar for project navigation.

click the task card make it grow into a full task form floating over the main interface.

Mobile-responsive design for tablets/phones.

Use firebase for backend (auth, database, real-time updates) and integrate email notifications for deadlines. Prioritize simplicity for Phase 1; we’ll add dashboards and advanced features in later phases.

Use React, next.js typescript and tailwind css

Styling Description

**Theme:**  
- **Clean, professional, and minimalistic SaaS dashboard**
- **Modern flat design** with high readability and soft contrast  
- Emphasis on clarity and function over decoration

**Color Palette:**  
- **Primary Color:** Soft blue `#E9F2FF` (background and accents)  
- **Accent Color:** Vibrant blue `#0052CC` (active elements, buttons, highlights)  
- **Secondary Colors:**  
  - Light gray `#F4F5F7` (column backgrounds)  
  - Mid gray `#DFE1E6` (borders, lines)  
  - Dark gray `#172B4D` (text headers)  
  - Yellow `#FFAB00` and Red `#DE350B` used as status markers  
- **Text Color:** Mostly neutral dark gray tones with occasional colored status icons

**Typography:**  
- **Sans-serif font** (like Inter, Helvetica, or Roboto)  
- Font weight varies from **regular (400)** for body to **semibold (600)** for headers  
- Clear text hierarchy with **medium to small font sizes**

**Layout and Spacing:**  
- **Multi-column layout** using cards in a **flex/grid layout**  
- **Generous padding and margins** between elements (16–24px)  
- Columns/cards have **rounded corners (8px)** and subtle shadows  
- Page uses a **max-width fluid layout** with side navigation and top bar  
- Sticky/fixed side and top navs with flat styling

**UI Elements:**  
- **Cards:** Rounded, light-colored with soft drop shadows  
- **Buttons & Tags:** Filled and outlined styles with primary or alert colors  
- **Icons:** Flat, minimal, and monochrome or soft-colored  
- **Hover States:** Subtle background highlight or border color shift  
- **Search Bar:** Rounded input with icon, light background  

**Interactions:**  
- Minimal visual noise, with smooth transitions  
- Clean status indicators and progress logic (no heavy animations)

**Overall Feel:**  
- **Sleek, business-like, and productivity-oriented**  
- Inspired by tools like Jira, Asana, or Notion  
- Great for dashboards, project management tools, or admin panels
  