// lib/timeline.ts
type Span = { id: string; start: Date; end: Date }; // inclusive start, exclusive end recommended

export function packSpans(spans: Span[]): Span[][] {
  const byStart = [...spans].sort((a, b) => a.start.getTime() - b.start.getTime());
  const lanes: Span[][] = [];
  const laneEnds: number[] = []; // end time per lane

  for (const s of byStart) {
    const sStart = s.start.getTime();
    let placed = false;

    for (let i = 0; i < laneEnds.length; i++) {
      if (sStart >= laneEnds[i]) {
        lanes[i].push(s);
        laneEnds[i] = s.end.getTime();
        placed = true;
        break;
      }
    }

    if (!placed) {
      lanes.push([s]);
      laneEnds.push(s.end.getTime());
    }
  }
  return lanes;
}

