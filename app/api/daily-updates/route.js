import pool from '../db';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const result = await pool.query('SELECT * FROM daily_updates ORDER BY timestamp DESC');
        const updates = result.rows.map(r => ({
            id: r.id,
            userId: r.user_id,
            text: r.text,
            timestamp: Number(r.timestamp)
        }));
        return NextResponse.json(updates);
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { id, userId, text, timestamp } = body;
        const updateTimestamp = timestamp || Date.now();
        await pool.query(
            `INSERT INTO daily_updates (id, user_id, text, timestamp)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (id) DO UPDATE SET
                 user_id = EXCLUDED.user_id,
                 text = EXCLUDED.text,
                 timestamp = EXCLUDED.timestamp`,
            [id, userId, text, updateTimestamp]
        );
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
