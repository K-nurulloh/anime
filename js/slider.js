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
  const resolveElement = (value) =>
    typeof value === 'string' ? document.querySelector(value) : value;

  const track = resolveElement(trackSelector);
  const dots = resolveElement(dotsSelector);
  if (!track) return;

  const slides = Array.from(track.children);
  if (!slides.length) return;

  createDots(dots, slides.length);

  let index = 0;
  let isPaused = false;
  let isDragging = false;
  let startX = 0;
  let startScroll = 0;
  let rafId = null;
  let lastTime = null;
  let timer = null;
  let activePointerId = null;

  const updateActiveDot = () => {
    const nearestIndex = slides.reduce(
      (closest, slide, idx) => {
        const distance = Math.abs(track.scrollLeft - slide.offsetLeft);
        if (distance < closest.distance) {
          return { index: idx, distance };
        }
        return closest;
      },
      { index: 0, distance: Number.POSITIVE_INFINITY }
    );

    index = nearestIndex.index;
    setActiveDot(dots, index);
  };

  const clearTimer = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  const pause = () => {
    isPaused = true;
    clearTimer();
  };

  const scrollToIndex = (nextIndex) => {
    const normalizedIndex = ((nextIndex % slides.length) + slides.length) % slides.length;
    const slide = slides[normalizedIndex];
    if (!slide) return;

    index = normalizedIndex;
    const offset = slide.offsetLeft - track.offsetLeft;

    track.scrollTo({
      left: offset,
      behavior: 'smooth',
    });

    setActiveDot(dots, index);
  };

  const startInterval = () => {
    clearTimer();
    const interval = Number(track.dataset.interval) || 4000;

    timer = setInterval(() => {
      if (isPaused || isDragging) return;
      scrollToIndex(index + 1);
    }, interval);
  };

  const resume = () => {
    isPaused = false;
    lastTime = null;

    if (track.dataset.carousel === 'interval') {
      startInterval();
    }
  };

  track.addEventListener('mouseenter', pause);
  track.addEventListener('mouseleave', () => {
    if (!isDragging) resume();
  });

  track.addEventListener(
    'touchstart',
    () => {
      pause();
    },
    { passive: true }
  );

  track.addEventListener(
    'touchend',
    () => {
      if (!isDragging) resume();
    },
    { passive: true }
  );

  track.addEventListener('pointerdown', (event) => {
    isDragging = true;
    activePointerId = event.pointerId;
    pause();

    startX = event.clientX;
    startScroll = track.scrollLeft;

    if (track.setPointerCapture) {
      track.setPointerCapture(event.pointerId);
    }
  });

  track.addEventListener('pointermove', (event) => {
    if (!isDragging) return;
    if (activePointerId !== event.pointerId) return;

    const walk = (event.clientX - startX) * 1.2;
    track.scrollLeft = startScroll - walk;
  });

  const endDrag = (event) => {
    if (!isDragging) return;
    if (event && activePointerId !== null && event.pointerId !== activePointerId) return;

    isDragging = false;

    if (event && track.releasePointerCapture) {
      try {
        track.releasePointerCapture(event.pointerId);
      } catch (_) {}
    }

    activePointerId = null;
    updateActiveDot();

    setTimeout(() => {
      resume();
    }, 120);
  };

  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);

  track.addEventListener('lostpointercapture', () => {
    if (!isDragging) return;

    isDragging = false;
    activePointerId = null;
    updateActiveDot();

    setTimeout(() => {
      resume();
    }, 120);
  });

  track.addEventListener('scroll', updateActiveDot);

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

    if (!isPaused && !isDragging) {
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