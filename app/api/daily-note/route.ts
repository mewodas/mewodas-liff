import { NextRequest, NextResponse } from 'next/server';
import { invalidate } from '@/lib/cache';
import { getCustomerByLineId } from '@/lib/notion';
import {
  getDailyNoteOnDate,
  upsertDailyNote,
  isDailyNoteEnabled,
  DAILY_NOTE_MAX_LENGTH,
} from '@/lib/repository/dailyNotes';
import { withLiffTenant } from '@/lib/withTenant';

export const runtime = 'nodejs';
export const maxDuration = 15;
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// その日1件の自由メモ（備考）。表示・保存とも Notion 日次備考DB（テナント別）が真実のソース。
// DB が割り当てられていないテナントでは enabled:false を返し、フロントはカード自体を非表示にする。
export const GET = withLiffTenant(async (req: NextRequest, _ctx: unknown, verifiedLineUserId: string) => {
  try {
    if (!isDailyNoteEnabled()) {
      return NextResponse.json({ enabled: false, note: '' });
    }
    const date = req.nextUrl.searchParams.get('date');
    if (!date) {
      return NextResponse.json({ error: 'date が必要' }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date は yyyy-MM-dd 形式' }, { status: 400 });
    }
    const log = await getDailyNoteOnDate(verifiedLineUserId, date).catch(() => null);
    const res = NextResponse.json({ enabled: true, note: log?.note ?? '' });
    res.headers.set('Cache-Control', 'no-store, must-revalidate');
    return res;
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
  }
});

export const POST = withLiffTenant(async (req: NextRequest, _ctx: unknown, verifiedLineUserId: string) => {
  try {
    if (!isDailyNoteEnabled()) {
      return NextResponse.json({ error: '備考機能は未設定です' }, { status: 503 });
    }
    const body = await req.json();
    const { date } = body;
    const rawNote = typeof body.note === 'string' ? body.note : '';

    if (!date) {
      return NextResponse.json({ error: 'date が必要です' }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date は yyyy-MM-dd 形式' }, { status: 400 });
    }
    if (rawNote.length > DAILY_NOTE_MAX_LENGTH) {
      return NextResponse.json(
        { error: `備考は${DAILY_NOTE_MAX_LENGTH}文字以内で入力してください` },
        { status: 400 }
      );
    }
    const note = rawNote.trim();

    // 顧客名は Notion 上の可読性向上のためのベストエフォート（未取得でも保存は成立させる）
    const customer = await getCustomerByLineId(verifiedLineUserId).catch(() => null);
    const customerName = customer?.name ?? '';

    await upsertDailyNote({
      lineUserId: verifiedLineUserId,
      customerName,
      date,
      note,
      source: 'LIFF',
    });

    invalidate('');

    return NextResponse.json({ ok: true, note });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
