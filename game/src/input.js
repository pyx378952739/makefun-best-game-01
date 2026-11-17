// Keyboard and mouse state, in canvas coordinates. The world only ever reads
// this object, so the same input shape can come from a real player or from the
// screenshot autopilot.
export function createInput(canvas) {
  const input = {
    moveX: 0,
    moveY: 0,
    aimX: 0,
    aimY: 0,
    firing: false,
    pressed: new Set(), // keys pressed since last consume (edge-triggered)
    mouseDown: false,
  };

  const keys = new Set();
  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
  };

  function refreshMove() {
    input.moveX = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
    input.moveY = (keys.has('down') ? 1 : 0) - (keys.has('up') ? 1 : 0);
  }

  function toCanvas(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) input.pressed.add(event.code);
    const mapped = KEYMAP[event.code];
    if (mapped) keys.add(mapped);
    if (event.code === 'Space') input.firing = true;
    refreshMove();
  });
  window.addEventListener('keyup', (event) => {
    const mapped = KEYMAP[event.code];
    if (mapped) keys.delete(mapped);
    if (event.code === 'Space') input.firing = false;
    refreshMove();
  });
  canvas.addEventListener('mousemove', (event) => {
    const p = toCanvas(event.clientX, event.clientY);
    input.aimX = p.x;
    input.aimY = p.y;
  });
  canvas.addEventListener('mousedown', (event) => {
    const p = toCanvas(event.clientX, event.clientY);
    input.aimX = p.x;
    input.aimY = p.y;
    input.mouseDown = true;
    input.firing = true;
  });
  window.addEventListener('mouseup', () => {
    input.mouseDown = false;
    if (!keys.has('Space')) input.firing = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  input.consume = function consume(code) {
    if (input.pressed.has(code)) {
      input.pressed.delete(code);
      return true;
    }
    return false;
  };

  return input;
}
