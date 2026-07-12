import pool from '../db';
import { NextResponse } from 'next/server';

export async function GET() {
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
        return NextResponse.json(pins);
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { id, type, title, content, url, method, color, createdBy, createdAt } = body;
        const pinCreatedAt = createdAt || Date.now();
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
            [id, type, title, content || null, url || null, method || 'GET', color || '#6366F1', createdBy, pinCreatedAt]
        );
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
