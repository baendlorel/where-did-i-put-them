import { createId } from './geometry';
import type { FloorShape, Furniture, Opening, Project, Wall } from './types';

const now = () => new Date().toISOString();

export function createEmptyProject(name = '未命名住宅'): Project {
  return {
    schemaVersion: 1,
    id: createId('project'),
    name,
    revision: 0,
    updatedAt: now(),
    floor: { shapes: [], walls: [], openings: [] },
    furniture: [],
  };
}

export function createStarterProject(name = '新住宅'): Project {
  const footprint: FloorShape = {
    id: createId('shape'),
    kind: 'rect',
    x: 0,
    y: 0,
    width: 8,
    height: 6,
    rotation: 0,
    mode: 'union',
  };
  const perimeter: Wall[] = [
    { id: createId('wall'), a: { x: 0, y: 0 }, b: { x: 8, y: 0 }, thickness: 0.2 },
    { id: createId('wall'), a: { x: 8, y: 0 }, b: { x: 8, y: 6 }, thickness: 0.2 },
    { id: createId('wall'), a: { x: 8, y: 6 }, b: { x: 0, y: 6 }, thickness: 0.2 },
    { id: createId('wall'), a: { x: 0, y: 6 }, b: { x: 0, y: 0 }, thickness: 0.2 },
  ];
  return {
    ...createEmptyProject(name),
    floor: { shapes: [footprint], walls: perimeter, openings: [] },
  };
}

/** A complete, lived-in demo apartment that also exercises every feature. */
export function createDemoProject(): Project {
  const shapes: FloorShape[] = [
    {
      id: 'shape_main',
      kind: 'rect',
      x: 0,
      y: 0,
      width: 10,
      height: 7,
      rotation: 0,
      mode: 'union',
    },
    {
      id: 'shape_wing',
      kind: 'rect',
      x: 10,
      y: 2.2,
      width: 3.2,
      height: 4.8,
      rotation: 0,
      mode: 'union',
    },
  ];

  const walls: Wall[] = [
    { id: 'wall_south', a: { x: 0, y: 0 }, b: { x: 10, y: 0 }, thickness: 0.24 },
    { id: 'wall_east_short', a: { x: 10, y: 0 }, b: { x: 10, y: 2.2 }, thickness: 0.24 },
    { id: 'wall_wing_south', a: { x: 10, y: 2.2 }, b: { x: 13.2, y: 2.2 }, thickness: 0.24 },
    { id: 'wall_east', a: { x: 13.2, y: 2.2 }, b: { x: 13.2, y: 7 }, thickness: 0.24 },
    { id: 'wall_north', a: { x: 13.2, y: 7 }, b: { x: 0, y: 7 }, thickness: 0.24 },
    { id: 'wall_west', a: { x: 0, y: 7 }, b: { x: 0, y: 0 }, thickness: 0.24 },
    { id: 'wall_mid_west', a: { x: 0, y: 4.4 }, b: { x: 5.2, y: 4.4 }, thickness: 0.16 },
    { id: 'wall_mid_east', a: { x: 5.2, y: 4.4 }, b: { x: 13.2, y: 4.4 }, thickness: 0.16 },
    { id: 'wall_center', a: { x: 5.2, y: 0 }, b: { x: 5.2, y: 4.4 }, thickness: 0.16 },
  ];

  const openings: Opening[] = [
    { id: 'door_entry', wallId: 'wall_south', kind: 'door', offset: 0.58, width: 1.05 },
    { id: 'win_living', wallId: 'wall_south', kind: 'window', offset: 0.2, width: 1.65 },
    { id: 'win_bedroom', wallId: 'wall_south', kind: 'window', offset: 0.82, width: 1.3 },
    { id: 'door_bedroom', wallId: 'wall_center', kind: 'door', offset: 0.78, width: 0.9 },
    { id: 'door_kitchen', wallId: 'wall_mid_west', kind: 'door', offset: 0.55, width: 0.9 },
    { id: 'door_study', wallId: 'wall_mid_east', kind: 'door', offset: 0.3, width: 0.9 },
    { id: 'win_west', wallId: 'wall_west', kind: 'window', offset: 0.46, width: 1.4 },
    { id: 'win_kitchen', wallId: 'wall_north', kind: 'window', offset: 0.22, width: 2.0 },
    { id: 'win_study', wallId: 'wall_north', kind: 'window', offset: 0.7, width: 2.6 },
    { id: 'win_wing', wallId: 'wall_east', kind: 'window', offset: 0.48, width: 1.55 },
    { id: 'win_wing_south', wallId: 'wall_wing_south', kind: 'window', offset: 0.5, width: 1.2 },
  ];

  const furniture: Furniture[] = [
    {
      id: 'f_sofa',
      kind: 'sofa',
      name: '客厅主沙发',
      x: 2.3,
      y: 1.25,
      rotation: 0,
      width: 2.2,
      depth: 0.92,
      color: '#b4825f',
      items: [
        { id: 'i_remote', name: '电视遥控器', quantity: 1, note: '藏在右侧坐垫缝里' },
        { id: 'i_headphone', name: '降噪耳机', quantity: 1, note: '收纳袋里' },
      ],
    },
    {
      id: 'f_coffee',
      kind: 'table',
      name: '客厅茶几',
      x: 2.25,
      y: 2.7,
      rotation: 0,
      width: 1.25,
      depth: 0.62,
      color: '#8f684c',
      items: [
        { id: 'i_magazine', name: '设计杂志', quantity: 4, note: '叠在第二层' },
        { id: 'i_candle', name: '香薰蜡烛', quantity: 2, note: '木托盘上' },
      ],
    },
    {
      id: 'f_tv',
      kind: 'cabinet',
      name: '客厅电视柜',
      x: 0.44,
      y: 3.72,
      rotation: Math.PI / 2,
      width: 1.8,
      depth: 0.46,
      color: '#7f927f',
      items: [
        { id: 'i_router', name: '备用路由器', quantity: 1, note: '最下层左侧' },
        { id: 'i_game', name: 'Switch 游戏机', quantity: 1, note: '配上两个手柄' },
      ],
    },
    {
      id: 'f_bed',
      kind: 'bed',
      name: '主卧床',
      x: 7.7,
      y: 1.45,
      rotation: 0,
      width: 1.85,
      depth: 2.05,
      color: '#c9b8a4',
      items: [{ id: 'i_blanket', name: '备用薄被', quantity: 1, note: '床下收纳箱' }],
    },
    {
      id: 'f_night_l',
      kind: 'nightstand',
      name: '左侧床头柜',
      x: 6.4,
      y: 0.72,
      rotation: 0,
      width: 0.52,
      depth: 0.46,
      color: '#b08f6e',
      items: [
        { id: 'i_passport', name: '护照', quantity: 2, note: '压在笔记本下面' },
        { id: 'i_charger', name: '65W 充电器', quantity: 1, note: '上层抽屉' },
        { id: 'i_mask', name: '蒸汽眼罩', quantity: 5, note: '' },
      ],
    },
    {
      id: 'f_night_r',
      kind: 'nightstand',
      name: '右侧床头柜',
      x: 9.0,
      y: 0.72,
      rotation: 0,
      width: 0.52,
      depth: 0.46,
      color: '#b08f6e',
      items: [{ id: 'i_watch', name: '旧手表', quantity: 2, note: '表盒里' }],
    },
    {
      id: 'f_wardrobe',
      kind: 'cabinet',
      name: '卧室衣柜',
      x: 9.5,
      y: 2.55,
      rotation: -Math.PI / 2,
      width: 1.9,
      depth: 0.54,
      color: '#7c8fa6',
      items: [
        { id: 'i_suitcase', name: '登机箱', quantity: 1, note: '顶柜' },
        { id: 'i_winter', name: '冬装收纳袋', quantity: 3, note: '换季区' },
      ],
    },
    {
      id: 'f_dining',
      kind: 'table',
      name: '餐桌',
      x: 2.15,
      y: 5.75,
      rotation: 0,
      width: 1.65,
      depth: 0.9,
      color: '#a9744f',
      items: [
        { id: 'i_camera', name: '胶片相机', quantity: 1, note: '桌边帆布袋' },
        { id: 'i_letters', name: '旧信件', quantity: 1, note: '铁盒里' },
      ],
    },
    {
      id: 'f_kitchen_cab',
      kind: 'cabinet',
      name: '餐边柜',
      x: 4.3,
      y: 5.05,
      rotation: 0,
      width: 1.35,
      depth: 0.48,
      color: '#9d6b53',
      items: [
        { id: 'i_coffee', name: '手冲咖啡豆', quantity: 3, note: '密封罐，浅烘' },
        { id: 'i_bake', name: '烘焙模具', quantity: 6, note: '下层叠放' },
      ],
    },
    {
      id: 'f_desk',
      kind: 'table',
      name: '书房工作台',
      x: 7.4,
      y: 5.85,
      rotation: 0,
      width: 1.8,
      depth: 0.82,
      color: '#8f684c',
      items: [
        { id: 'i_laptop', name: '备用笔记本电脑', quantity: 1, note: '左侧抽屉，电量 60%' },
        { id: 'i_ssd', name: '移动硬盘', quantity: 2, note: '线材在同一个收纳盒' },
      ],
    },
    {
      id: 'f_study_cab',
      kind: 'cabinet',
      name: '书房文件柜',
      x: 10.0,
      y: 4.72,
      rotation: 0,
      width: 1.55,
      depth: 0.48,
      color: '#6f7b70',
      items: [
        { id: 'i_contract', name: '房屋合同', quantity: 1, note: '第二层，蓝色文件夹' },
        { id: 'i_ink', name: '打印机墨盒', quantity: 3, note: '' },
      ],
    },
    {
      id: 'f_bench',
      kind: 'sofa',
      name: '窗边长凳',
      x: 11.7,
      y: 6.2,
      rotation: Math.PI,
      width: 1.6,
      depth: 0.72,
      color: '#a58b9e',
      items: [{ id: 'i_yoga', name: '瑜伽毯', quantity: 1, note: '卷起放在座位下' }],
    },
  ];

  return {
    schemaVersion: 1,
    id: 'project_wutong',
    name: '梧桐宅 · 85㎡',
    revision: 1,
    updatedAt: now(),
    floor: { shapes, walls, openings },
    furniture,
  };
}
