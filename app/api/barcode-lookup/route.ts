import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 15;
export const dynamic = 'force-dynamic';

type ProductResult = {
  found: boolean;
  source: 'openfoodfacts' | 'none';
  title: string;
  brand: string;
  imageUrl: string | null;
  servingSize: string;
  kcal: number;
  P: number;
  F: number;
  C: number;
  perServing: boolean;
};

export async function GET(req: NextRequest) {
  const barcode = req.nextUrl.searchParams.get('barcode')?.trim();
  if (!barcode || !/^\d{8,14}$/.test(barcode)) {
    return NextResponse.json({ error: '有効なバーコード番号が必要です' }, { status: 400 });
  }

  try {
    // Open Food Facts API (v2)
    const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,product_name_ja,brands,image_url,nutriments,serving_size,serving_quantity`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'FitMeal-LIFF/1.0' },
      // 7秒で打ち切り
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) {
      const empty: ProductResult = {
        found: false,
        source: 'none',
        title: '',
        brand: '',
        imageUrl: null,
        servingSize: '',
        kcal: 0,
        P: 0,
        F: 0,
        C: 0,
        perServing: false,
      };
      return NextResponse.json(empty);
    }
    const json = await res.json();
    if (json.status !== 1 || !json.product) {
      const empty: ProductResult = {
        found: false,
        source: 'none',
        title: '',
        brand: '',
        imageUrl: null,
        servingSize: '',
        kcal: 0,
        P: 0,
        F: 0,
        C: 0,
        perServing: false,
      };
      return NextResponse.json(empty);
    }

    const p = json.product;
    const nut = p.nutriments || {};
    const servingQty = Number(p.serving_quantity ?? 0);

    // serving 単位の値があればそれを優先、なければ 100g 単位 × serving換算
    let kcal = Number(nut['energy-kcal_serving'] ?? 0);
    let pVal = Number(nut['proteins_serving'] ?? 0);
    let fVal = Number(nut['fat_serving'] ?? 0);
    let cVal = Number(nut['carbohydrates_serving'] ?? 0);
    let perServing = true;

    if (!kcal) {
      kcal = Number(nut['energy-kcal_100g'] ?? 0);
      pVal = Number(nut['proteins_100g'] ?? 0);
      fVal = Number(nut['fat_100g'] ?? 0);
      cVal = Number(nut['carbohydrates_100g'] ?? 0);
      perServing = false;
      // serving_quantity が分かれば換算する
      if (servingQty > 0) {
        const ratio = servingQty / 100;
        kcal = kcal * ratio;
        pVal = pVal * ratio;
        fVal = fVal * ratio;
        cVal = cVal * ratio;
        perServing = true;
      }
    }

    const result: ProductResult = {
      found: true,
      source: 'openfoodfacts',
      title: String(p.product_name_ja || p.product_name || '名称不明'),
      brand: String(p.brands || ''),
      imageUrl: p.image_url || null,
      servingSize: String(p.serving_size || (perServing ? '1食分' : '100gあたり')),
      kcal: Math.round(kcal),
      P: Math.round(pVal * 10) / 10,
      F: Math.round(fVal * 10) / 10,
      C: Math.round(cVal * 10) / 10,
      perServing,
    };
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
