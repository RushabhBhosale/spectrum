'use client';

import { memo, useEffect, useRef } from 'react';
import { ratingBuckets } from '@/lib/stats';
import type { Title } from '@/lib/types';

function Ratings({ titles }: { titles: Title[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current!;
    const draw = () => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      if (!width) return;
      const dpr = Math.min(2, devicePixelRatio || 1);
      element.width = Math.round(width * dpr);
      element.height = Math.round(height * dpr);
      const ctx = element.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const buckets = ratingBuckets(titles);
      if (!buckets.length) return;
      const tallest = Math.max(...buckets.map((b) => b.titles.length));
      const gap = width < 500 ? 4 : 8;
      const barWidth = (width - gap * (buckets.length - 1)) / buckets.length;
      const unit = (height - 42) / tallest;
      ctx.font = `500 11px ${getComputedStyle(element).getPropertyValue('--mono')}`;
      ctx.textAlign = 'center';
      buckets.forEach((bucket, index) => {
        const x = index * (barWidth + gap);
        let y = height - 22;
        for (const title of bucket.titles) {
          ctx.fillStyle = title.accent;
          ctx.fillRect(x, y - unit, barWidth, unit + 0.4);
          y -= unit;
        }
        ctx.fillStyle = '#f0ece4';
        if (bucket.titles.length) ctx.fillText(String(bucket.titles.length), x + barWidth / 2, y - 6);
        ctx.fillStyle = '#a19d95';
        const label = Number.isInteger(bucket.rating) && width < 420 ? String(bucket.rating) : bucket.rating.toFixed(1);
        ctx.fillText(label, x + barWidth / 2, height - 6);
      });
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(element);
    document.fonts?.ready.then(draw);
    return () => observer.disconnect();
  }, [titles]);

  return <canvas className="ratings" ref={canvas} role="img" aria-label="How many titles have each rating" />;
}

export default memo(Ratings);
