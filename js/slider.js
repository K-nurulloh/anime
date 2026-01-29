const createDots = (dotsEl, count) => {
  if (!dotsEl) return;
  dotsEl.innerHTML = Array.from({ length: count })
    .map((_, index) => `<span class="dot${index === 0 ? ' active' : ''}"></span>`)
    .join('');
};

const setActiveDot = (dotsEl, index) => {
  if (!dotsEl) return;
  dotsEl.querySelectorAll('.dot').forEach((dot, idx) => {
    dot.classList.toggle('active', idx === index);
  });
};

export const initAutoCarousel = (trackSelector, dotsSelector, speed = 18) => {
  const resolveElement = (value) => (typeof value === 'string' ? document.querySelector(value) : value);
  const track = resolveElement(trackSelector);
  const dots = resolveElement(dotsSelector);
  if (!track) return;

  const slides = Array.from(track.children);
  if (!slides.length) return;

  createDots(dots, slides.length);

  let index = 0;
  let isPaused = false;
  let startX = 0;
  let startScroll = 0;
  let rafId = null;
  let lastTime = null;
  let timer = null;

  const updateActiveDot = () => {
    const nearestIndex = slides.reduce((closest, slide, idx) => {
      const distance = Math.abs(track.scrollLeft - slide.offsetLeft);
      if (distance < closest.distance) {
        return { index: idx, distance };
      }
      return closest;
    }, { index: 0, distance: Number.POSITIVE_INFINITY });
    index = nearestIndex.index;
    setActiveDot(dots, index);
  };

  const pause = () => {
    isPaused = true;
    if (timer) clearInterval(timer);
  };

  const resume = () => {
    isPaused = false;
    lastTime = null;
    if (track.dataset.carousel === 'interval') {
      startInterval();
    }
  };

  track.addEventListener('mouseenter', pause);
  track.addEventListener('mouseleave', resume);
  track.addEventListener('touchstart', pause, { passive: true });
  track.addEventListener('touchend', resume);

  track.addEventListener('pointerdown', (event) => {
    isPaused = true;
    startX = event.pageX - track.offsetLeft;
    startScroll = track.scrollLeft;
    track.setPointerCapture(event.pointerId);
  });

  track.addEventListener('pointermove', (event) => {
    if (!isPaused) return;
    const x = event.pageX - track.offsetLeft;
    const walk = (x - startX) * 1.2;
    track.scrollLeft = startScroll - walk;
  });

  track.addEventListener('pointerup', () => {
    isPaused = false;
    resume();
  });

  track.addEventListener('scroll', updateActiveDot);

  const scrollToIndex = (nextIndex) => {
    const slide = slides[nextIndex];
    if (!slide) return;
    const offset = slide.offsetLeft - track.offsetLeft;
    track.scrollTo({ left: offset, behavior: 'smooth' });
    setActiveDot(dots, nextIndex);
  };

  const startInterval = () => {
    if (timer) clearInterval(timer);
    const interval = Number(track.dataset.interval) || 4000;
    timer = setInterval(() => {
      if (isPaused) return;
      index = (index + 1) % slides.length;
      scrollToIndex(index);
    }, interval);
  };

  if (track.dataset.carousel === 'interval') {
    scrollToIndex(0);
    updateActiveDot();
    startInterval();
    return;
  }

  const animate = (time) => {
    if (!lastTime) lastTime = time;
    const delta = (time - lastTime) / 1000;
    lastTime = time;
    if (!isPaused) {
      track.scrollLeft += speed * delta;
      const maxScroll = track.scrollWidth - track.clientWidth;
      if (track.scrollLeft >= maxScroll - 1) {
        track.scrollLeft = 0;
      }
    }
    updateActiveDot();
    rafId = requestAnimationFrame(animate);
  };

  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(animate);
};
