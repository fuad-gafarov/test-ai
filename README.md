# 📋 Kanban Task Manager

A simple, elegant CRUD application for managing tasks on a Kanban board. Create, read, update, and delete tasks while organizing them across three columns: To Do, In Progress, and Done.

## ✨ Features

- **Create Tasks** - Add new tasks with title and description
- **Read Tasks** - View all tasks organized by status columns
- **Update Tasks** - Move tasks between columns (To Do → In Progress → Done)
- **Delete Tasks** - Remove tasks from the board
- **Responsive Design** - Works seamlessly on desktop and mobile devices
- **Real-time UI** - Instant updates without page refresh

## 🛠️ Tech Stack

**Backend:**
- Node.js
- Express.js
- REST API

**Frontend:**
- HTML5
- CSS3
- Vanilla JavaScript

## 🚀 Getting Started

### Prerequisites
- Node.js (v12 or higher)
- npm

### Installation

1. Clone the repository:
```bash
git clone https://github.com/fuad-gafarov/test-ai.git
cd test-ai
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open your browser and navigate to:
```
http://localhost:3000
```

## 📖 API Endpoints

### Get all tasks
```
GET /api/tasks
```

### Get task by ID
```
GET /api/tasks/:id
```

### Create a new task
```
POST /api/tasks
Body: { "title": "Task title", "description": "Task description", "status": "todo" }
```

### Update a task
```
PUT /api/tasks/:id
Body: { "title": "Updated title", "description": "Updated description", "status": "in-progress" }
```

### Delete a task
```
DELETE /api/tasks/:id
```

## 📝 Task Status

Tasks can have one of three statuses:
- `todo` - New tasks to be started
- `in-progress` - Tasks currently being worked on
- `done` - Completed tasks

## ��� Project Structure

```
test-ai/
├── public/
│   ├── index.html      # Main UI
│   ├── style.css       # Styling
│   └── script.js       # Client-side logic
├── server.js           # Express server & API
├── package.json        # Dependencies
├── .gitignore          # Git ignore rules
└── README.md           # This file
```

## 🎨 Features in Detail

### Adding a Task
1. Enter a task title and optional description
2. Click "Add Task"
3. Task appears in the "To Do" column

### Moving Tasks
1. Click the "Move →" button on any task
2. Task moves to the next column (To Do → In Progress → Done → To Do)

### Deleting Tasks
1. Click the "Delete" button on a task
2. Confirm the deletion
3. Task is removed from the board

## 🔮 Future Enhancements

- Database persistence (MongoDB/PostgreSQL)
- User authentication
- Drag-and-drop task movement
- Task due dates and priorities
- Task filtering and search
- Dark mode
- Real-time collaboration

## 📄 License

This project is open source and available under the MIT License.

## 👤 Author

Created by [@fuad-gafarov](https://github.com/fuad-gafarov)

## 🤝 Contributing

Contributions are welcome! Feel free to fork the repository and submit pull requests.

---

**Happy task managing! 🎉**