const SVG_NS = 'http://www.w3.org/2000/svg';

function buildPetalRing(groupEl, { count, length, width, radius, fill, opacity }) {
  for (let i = 0; i < count; i++) {
    const angle = (360 / count) * i;
    const path = document.createElementNS(SVG_NS, 'path');
    const d =
      `M0,${-radius} C${-width},${-radius - length * 0.55} ${-width * 0.8},${-radius - length} 0,${-radius - length} ` +
      `C${width * 0.4},${-radius - length} ${width},${-radius - length * 0.55} 0,${-radius} Z`;
    path.setAttribute('d', d);
    path.setAttribute('fill', fill);
    path.setAttribute('opacity', opacity);
    path.setAttribute('transform', `rotate(${angle})`);
    groupEl.appendChild(path);
  }
}

buildPetalRing(document.getElementById('ring-outer'), {
  count: 10,
  length: 168,
  width: 46,
  radius: 34,
  fill: 'url(#petalOuter)',
  opacity: 0.85,
});

buildPetalRing(document.getElementById('ring-middle'), {
  count: 8,
  length: 118,
  width: 36,
  radius: 22,
  fill: 'url(#petalMiddle)',
  opacity: 0.92,
});

buildPetalRing(document.getElementById('ring-inner'), {
  count: 6,
  length: 70,
  width: 24,
  radius: 10,
  fill: 'url(#petalInner)',
  opacity: 1,
});
