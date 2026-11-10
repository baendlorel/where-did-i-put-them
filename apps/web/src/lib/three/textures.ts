import * as THREE from 'three';

let seed = 9271;
function random(): number {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
}

export function createWoodTexture(anisotropy = 4): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const base = ctx.createLinearGradient(0, 0, 0, 512);
  base.addColorStop(0, '#d5b486');
  base.addColorStop(0.5, '#cbab7e');
  base.addColorStop(1, '#d8b98d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);

  const plankHeight = 64;
  for (let row = 0; row < 8; row += 1) {
    const y = row * plankHeight;
    const tone = 0.92 + random() * 0.13;
    ctx.fillStyle = `rgba(${Math.round(177 * tone)}, ${Math.round(139 * tone)}, ${Math.round(96 * tone)}, 0.24)`;
    ctx.fillRect(0, y, 512, plankHeight);
    ctx.strokeStyle = 'rgba(107, 78, 48, 0.28)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(512, y + 0.5);
    ctx.stroke();

    const offset = row % 2 === 0 ? 86 : 0;
    for (let joint = offset; joint < 512; joint += 256) {
      ctx.strokeStyle = 'rgba(103, 75, 47, 0.24)';
      ctx.beginPath();
      ctx.moveTo(joint, y);
      ctx.lineTo(joint, y + plankHeight);
      ctx.stroke();
    }

    for (let grain = 0; grain < 15; grain += 1) {
      const gy = y + 5 + random() * (plankHeight - 10);
      ctx.strokeStyle = `rgba(105, 76, 46, ${0.045 + random() * 0.055})`;
      ctx.lineWidth = 0.7 + random() * 1.1;
      ctx.beginPath();
      const startX = random() * 80;
      ctx.moveTo(startX, gy);
      for (let x = startX; x < 512; x += 24) {
        ctx.lineTo(x, gy + Math.sin((x + row * 19) * 0.026) * 2.4 + (random() - 0.5) * 1.5);
      }
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  texture.repeat.set(0.28, 0.28);
  return texture;
}

export function createFabricTexture(color: string, anisotropy = 4): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 128; i += 3) {
    ctx.strokeStyle = i % 6 === 0 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.035)';
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 128);
    ctx.moveTo(0, i);
    ctx.lineTo(128, i);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  texture.repeat.set(2.4, 2.4);
  return texture;
}

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

export function createLabelTexture(title: string, subtitle: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 180;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(40, 50, 45, 0.94)';
  drawRoundRect(ctx, 8, 8, 624, 164, 26);
  ctx.fill();
  ctx.fillStyle = '#c47049';
  drawRoundRect(ctx, 8, 8, 10, 164, 5);
  ctx.fill();

  ctx.fillStyle = '#fbf7ef';
  ctx.font = '600 42px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const clippedTitle = title.length > 15 ? `${title.slice(0, 15)}…` : title;
  ctx.fillText(clippedTitle, 44, 70);

  ctx.fillStyle = 'rgba(246, 240, 230, 0.62)';
  ctx.font = '400 26px "PingFang SC", "Microsoft YaHei", sans-serif';
  const clippedSubtitle = subtitle.length > 24 ? `${subtitle.slice(0, 24)}…` : subtitle;
  ctx.fillText(clippedSubtitle, 44, 124);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function createCountTexture(count: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 72;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 128, 72);
  ctx.fillStyle = 'rgba(40, 50, 45, 0.9)';
  drawRoundRect(ctx, 20, 12, 88, 48, 24);
  ctx.fill();
  ctx.fillStyle = '#f8f2e7';
  ctx.font = '600 26px "Avenir Next", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(count > 99 ? '99+ 件' : `${count} 件`, 64, 37);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
