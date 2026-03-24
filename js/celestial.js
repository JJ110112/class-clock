/* ══════════════════════════════════
   Celestial Body – Sun/Moon PNG Images
   12 variants each, changes hourly + on click
   ══════════════════════════════════ */

const CELESTIAL_COUNT = 12;

class CelestialBody {
  /**
   * @param {Object} opts
   * @param {string} opts.type - 'sun' or 'moon'
   * @param {number} [opts.size=80] - display size in px
   * @param {number} [opts.zIndex=10] - CSS z-index
   * @param {string} [opts.basePath] - path prefix to img folder
   */
  constructor(opts = {}) {
    this.type = opts.type || 'moon';
    this.size = opts.size || (this.type === 'sun' ? 100 : 90);
    const zIdx = opts.zIndex ?? 10;
    this.basePath = opts.basePath || '../img';

    // State
    this.x = -200;
    this.y = -200;
    this.alpha = 0;
    this.targetX = -200;
    this.targetY = -200;
    this.targetAlpha = 0;
    this.hours = new Date().getHours();
    this.minutes = new Date().getMinutes();
    this.lastChangeHour = -1;

    // Image index (1-12)
    this.imgIndex = (this.hours % CELESTIAL_COUNT) + 1;

    // Preload all 12 images
    this.images = [];
    this.loaded = 0;
    for (let i = 1; i <= CELESTIAL_COUNT; i++) {
      const img = new Image();
      const folder = this.type === 'sun' ? 'sun' : 'moon';
      const prefix = this.type === 'sun' ? 'sun' : 'moon';
      img.src = `${this.basePath}/${folder}/${prefix}_${String(i).padStart(2, '0')}.png`;
      img.onload = () => { this.loaded++; };
      this.images.push(img);
    }

    // Create DOM element (img tag, simpler than canvas for PNG display)
    const glowSize = Math.round(this.size * 0.4);
    const sunFilter = `drop-shadow(0 0 ${glowSize}px rgba(253,184,19,0.6)) drop-shadow(0 0 ${glowSize * 2}px rgba(255,140,0,0.3))`;
    const moonFilter = `drop-shadow(0 0 ${glowSize}px rgba(200,220,255,0.7)) drop-shadow(0 0 ${glowSize * 2}px rgba(150,180,220,0.4)) brightness(1.3)`;

    this.el = document.createElement('div');
    this.el.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: ${zIdx};
      width: ${this.size}px;
      height: ${this.size}px;
      transition: opacity 0.5s;
      filter: ${this.type === 'sun' ? sunFilter : moonFilter};
    `;

    this.imgEl = document.createElement('img');
    this.imgEl.style.cssText = 'width:100%;height:100%;object-fit:contain;transition:opacity 0.4s;';
    this.imgEl.draggable = false;
    this.el.appendChild(this.imgEl);

    this._updateImage();

    document.body.appendChild(this.el);

    window.addEventListener('resize', () => this._updatePosition());
  }

  /** Update time */
  setTime(hours, minutes) {
    this.hours = hours;
    this.minutes = minutes;

    // Change image every hour
    if (this.lastChangeHour !== hours) {
      this.lastChangeHour = hours;
      this.imgIndex = (hours % CELESTIAL_COUNT) + 1;
      this._updateImage();
    }
  }

  /** Cycle to next image (called on click) */
  nextImage() {
    this.imgIndex = (this.imgIndex % CELESTIAL_COUNT) + 1;
    this._fadeSwapImage();
  }

  /**
   * Check if click coordinates hit this celestial body.
   * If hit, cycles image and returns true. Otherwise returns false.
   * @param {number} cx - click x
   * @param {number} cy - click y
   * @returns {boolean}
   */
  handleClick(cx, cy) {
    const half = this.size / 2;
    const dx = cx - this.x, dy = cy - this.y;
    if (dx * dx + dy * dy < half * half) {
      this.nextImage();
      return true;
    }
    return false;
  }

  _updateImage() {
    const idx = this.imgIndex - 1;
    if (this.images[idx] && this.images[idx].complete) {
      this.imgEl.src = this.images[idx].src;
    } else {
      // Fallback: set src directly
      const folder = this.type === 'sun' ? 'sun' : 'moon';
      const prefix = this.type === 'sun' ? 'sun' : 'moon';
      this.imgEl.src = `${this.basePath}/${folder}/${prefix}_${String(this.imgIndex).padStart(2, '0')}.png`;
    }
  }

  _fadeSwapImage() {
    this.imgEl.style.opacity = '0';
    setTimeout(() => {
      this._updateImage();
      this.imgEl.style.opacity = '1';
    }, 300);
  }

  /** Compute position based on current time */
  _computePosition() {
    const t = this.hours + this.minutes / 60;
    const W = window.innerWidth, H = window.innerHeight;

    if (this.type === 'sun') {
      const prog = (t - 6) / 12;
      const p = Math.max(0, Math.min(1, prog));
      this.targetX = W * 0.08 + p * W * 0.84;
      this.targetY = H * 0.13 - Math.sin(p * Math.PI) * H * 0.09;
      this.targetAlpha = 1;
    } else {
      const prog = ((t < 12 ? t + 24 : t) - 18) / 12;
      const p = Math.max(0, Math.min(1, prog));
      this.targetX = W * 0.1 + p * W * 0.8;
      this.targetY = H * 0.08 + Math.sin(p * Math.PI) * (-H * 0.05);
      this.targetAlpha = 1;
    }
  }

  /** Call each frame with delta time in seconds */
  update(dt) {
    this._computePosition();

    // Smooth interpolation
    this.x += (this.targetX - this.x) * 0.02;
    this.y += (this.targetY - this.y) * 0.02;
    this.alpha += (this.targetAlpha - this.alpha) * 0.02;

    this._updatePosition();
  }

  _updatePosition() {
    const half = this.size / 2;
    this.el.style.left = `${this.x - half}px`;
    this.el.style.top = `${this.y - half}px`;
    this.el.style.opacity = this.alpha;
  }

  destroy() {
    if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
  }
}

// Export globally
window.CelestialBody = CelestialBody;
