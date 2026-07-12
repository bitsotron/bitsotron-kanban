import pool from '../db';
import { NextResponse } from 'next/server';

export async function GET() {
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
        return NextResponse.json(tasks);
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { id, title, description, status, priority, dueDate, assignees, activity, createdBy, createdAt, updatedAt } = body;
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
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
