export const getFolderColor = (str: string): string => {
  if (!str) return '#ffffff';
  let colors: Record<string, string> = {};
  try {
    colors = JSON.parse(localStorage.getItem('papercache-folder-colors') || '{}');
  } catch (e) {}
  
  if (colors[str]) return colors[str];
  
  const usedHues = Object.values(colors).map(c => {
    const match = c.match(/hsl\((\d+)/);
    return match ? parseInt(match[1]) : null;
  }).filter(h => h !== null) as number[];
  
  let bestHue = 0;
  if (usedHues.length > 0) {
     usedHues.sort((a,b) => a - b);
     let maxDist = 0;
     for (let i = 0; i < usedHues.length; i++) {
        const next = (i + 1) % usedHues.length;
        let dist = usedHues[next] - usedHues[i];
        if (dist <= 0) dist += 360;
        if (dist > maxDist) {
           maxDist = dist;
           bestHue = (usedHues[i] + dist / 2) % 360;
        }
     }
  } else {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    bestHue = Math.abs(hash % 360);
  }
  
  const color = `hsl(${Math.round(bestHue)}, 70%, 60%)`;
  colors[str] = color;
  localStorage.setItem('papercache-folder-colors', JSON.stringify(colors));
  return color;
};
