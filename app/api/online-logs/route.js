import pool from '../db';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const result = await pool.query('SELECT * FROM online_logs ORDER BY timestamp DESC');
        const logs = result.rows.map(r => ({
            id: r.id,
            userName: r.user_name,
            type: r.type,
            details: r.details || '',
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
        const { id, userName, type, details, timestamp } = body;
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
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
