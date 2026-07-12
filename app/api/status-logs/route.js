import pool from '../db';
import { NextResponse } from 'next/server';

export async function GET() {
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
        return NextResponse.json(logs);
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { id, taskId, taskTitle, userName, fromStatus, toStatus, timestamp } = body;
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
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
