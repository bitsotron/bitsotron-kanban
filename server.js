const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Setup Neon PG Connection Pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_YQxu8LlSZMf4@ep-small-shape-atrhlzeh-pooler.c-9.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require',
});

app.use(express.json());
app.use(express.static(__dirname));

// Tasks Endpoints
app.get('/api/tasks', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM tasks ORDER BY created_at ASC');
        const tasks = result.rows.map(r => ({
            id: r.id,
            title: r.title,
            description: r.description,
            status: r.status,
            priority: r.priority,
            dueDate: r.due_date,
            assignees: r.assignees || [],
            activity: r.activity || [],
            createdBy: r.created_by,
            createdAt: Number(r.created_at),
            updatedAt: Number(r.updated_at)
        }));
        res.json(tasks);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/tasks', async (req, res) => {
    try {
        const { id, title, description, status, priority, dueDate, assignees, activity, createdBy, createdAt, updatedAt } = req.body;
        await pool.query(
            `INSERT INTO tasks (id, title, description, status, priority, due_date, assignees, activity, created_by, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (id) DO UPDATE SET
                 title = EXCLUDED.title,
                 description = EXCLUDED.description,
                 status = EXCLUDED.status,
                 priority = EXCLUDED.priority,
                 due_date = EXCLUDED.due_date,
                 assignees = EXCLUDED.assignees,
                 activity = EXCLUDED.activity,
                 created_by = EXCLUDED.created_by,
                 created_at = EXCLUDED.created_at,
                 updated_at = EXCLUDED.updated_at`,
            [id, title, description, status, priority, dueDate || null, JSON.stringify(assignees || []), JSON.stringify(activity || []), createdBy, createdAt, updatedAt]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Daily Updates
app.get('/api/daily-updates', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM daily_updates ORDER BY timestamp DESC');
        const updates = result.rows.map(r => ({
            id: r.id,
            userId: r.user_id,
            text: r.text,
            timestamp: Number(r.timestamp)
        }));
        res.json(updates);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/daily-updates', async (req, res) => {
    try {
        const { id, userId, text, timestamp } = req.body;
        await pool.query(
            `INSERT INTO daily_updates (id, user_id, text, timestamp)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (id) DO UPDATE SET
                 user_id = EXCLUDED.user_id,
                 text = EXCLUDED.text,
                 timestamp = EXCLUDED.timestamp`,
            [id, userId, text, timestamp]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Status Logs
app.get('/api/status-logs', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM status_logs ORDER BY timestamp DESC');
        const logs = result.rows.map(r => ({
            id: r.id,
            taskId: r.task_id,
            taskTitle: r.task_title,
            userName: r.user_name,
            fromStatus: r.from_status,
            toStatus: r.to_status,
            timestamp: Number(r.timestamp)
        }));
        res.json(logs);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/status-logs', async (req, res) => {
    try {
        const { id, taskId, taskTitle, userName, fromStatus, toStatus, timestamp } = req.body;
        await pool.query(
            `INSERT INTO status_logs (id, task_id, task_title, user_name, from_status, to_status, timestamp)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (id) DO UPDATE SET
                 task_id = EXCLUDED.task_id,
                 task_title = EXCLUDED.task_title,
                 user_name = EXCLUDED.user_name,
                 from_status = EXCLUDED.from_status,
                 to_status = EXCLUDED.to_status,
                 timestamp = EXCLUDED.timestamp`,
            [id, taskId, taskTitle, userName, fromStatus, toStatus, timestamp]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Online Logs
app.get('/api/online-logs', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM online_logs ORDER BY timestamp DESC');
        const logs = result.rows.map(r => ({
            id: r.id,
            userName: r.user_name,
            type: r.type,
            details: r.details || '',
            timestamp: Number(r.timestamp)
        }));
        res.json(logs);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/online-logs', async (req, res) => {
    try {
        const { id, userName, type, details, timestamp } = req.body;
        await pool.query(
            `INSERT INTO online_logs (id, user_name, type, details, timestamp)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (id) DO UPDATE SET
                 user_name = EXCLUDED.user_name,
                 type = EXCLUDED.type,
                 details = EXCLUDED.details,
                 timestamp = EXCLUDED.timestamp`,
            [id, userName, type, details || null, timestamp]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Pins Endpoints
app.get('/api/pins', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM pins ORDER BY created_at DESC');
        const pins = result.rows.map(r => ({
            id: r.id,
            type: r.type,
            title: r.title,
            content: r.content || '',
            url: r.url || '',
            method: r.method || 'GET',
            color: r.color || '#6366F1',
            createdBy: r.created_by,
            createdAt: Number(r.created_at)
        }));
        res.json(pins);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/pins', async (req, res) => {
    try {
        const { id, type, title, content, url, method, color, createdBy, createdAt } = req.body;
        await pool.query(
            `INSERT INTO pins (id, type, title, content, url, method, color, created_by, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (id) DO UPDATE SET
                 type = EXCLUDED.type,
                 title = EXCLUDED.title,
                 content = EXCLUDED.content,
                 url = EXCLUDED.url,
                 method = EXCLUDED.method,
                 color = EXCLUDED.color,
                 created_by = EXCLUDED.created_by,
                 created_at = EXCLUDED.created_at`,
            [id, type, title, content || null, url || null, method || 'GET', color || '#6366F1', createdBy, createdAt]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/pins/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM pins WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Fallback to index.html for static hosting
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server listening on port ${port}`);
    });
}

module.exports = app;
