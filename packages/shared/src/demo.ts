import { STAIR_DEFAULTS } from './catalog';
import { createId } from './geometry';
import { floorName } from './types';
import type {
  FloorPlan,
  FloorShape,
  Furniture,
  House,
  Opening,
  Stair,
  Wall,
  Workspace,
} from './types';

const now = () => new Date().toISOString();

export function createFloorPlan(level = 0, name = floorName(level)): FloorPlan {
  return {
    id: createId('floor'),
    name,
    level,
    shapes: [],
    walls: [],
    openings: [],
    furniture: [],
    stairs: [],
  };
}

export function createStarterFloor(level = 0): FloorPlan {
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
    ...createFloorPlan(level),
    shapes: [footprint],
    walls: perimeter,
  };
}

export function createStarterHouse(name = '新的家'): House {
  return {
    id: createId('house'),
    name,
    floors: [createStarterFloor(0)],
  };
}

export function createEmptyWorkspace(): Workspace {
  return {
    schemaVersion: 2,
    id: createId('workspace'),
    revision: 0,
    updatedAt: now(),
    houses: [createStarterHouse()],
  };
}

function upperFloor(): FloorPlan {
  const level = 1;
  const shapes: FloorShape[] = [
    {
      id: 'u_shape_main',
      kind: 'rect',
      x: 0,
      y: 0,
      width: 10,
      height: 7,
      rotation: 0,
      mode: 'union',
    },
    {
      id: 'u_shape_wing',
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
    { id: 'u_wall_south', a: { x: 0, y: 0 }, b: { x: 10, y: 0 }, thickness: 0.24 },
    { id: 'u_wall_east_short', a: { x: 10, y: 0 }, b: { x: 10, y: 2.2 }, thickness: 0.24 },
    { id: 'u_wall_wing_south', a: { x: 10, y: 2.2 }, b: { x: 13.2, y: 2.2 }, thickness: 0.24 },
    { id: 'u_wall_east', a: { x: 13.2, y: 2.2 }, b: { x: 13.2, y: 7 }, thickness: 0.24 },
    { id: 'u_wall_north', a: { x: 13.2, y: 7 }, b: { x: 0, y: 7 }, thickness: 0.24 },
    { id: 'u_wall_west', a: { x: 0, y: 7 }, b: { x: 0, y: 0 }, thickness: 0.24 },
    { id: 'u_wall_center', a: { x: 6.4, y: 0 }, b: { x: 6.4, y: 4.4 }, thickness: 0.16 },
    { id: 'u_wall_mid', a: { x: 0, y: 4.4 }, b: { x: 13.2, y: 4.4 }, thickness: 0.16 },
    { id: 'u_wall_bath', a: { x: 9.4, y: 4.4 }, b: { x: 9.4, y: 7 }, thickness: 0.14 },
  ];

  const openings: Opening[] = [
    { id: 'u_door_left', wallId: 'u_wall_center', kind: 'door', offset: 0.18, width: 0.9 },
    { id: 'u_door_left_b', wallId: 'u_wall_center', kind: 'door', offset: 0.72, width: 0.9 },
    { id: 'u_door_mid_left', wallId: 'u_wall_mid', kind: 'door', offset: 0.28, width: 0.9 },
    { id: 'u_door_mid_right', wallId: 'u_wall_mid', kind: 'door', offset: 0.7, width: 0.9 },
    { id: 'u_door_bath', wallId: 'u_wall_bath', kind: 'door', offset: 0.45, width: 0.8 },
    { id: 'u_win_south_a', wallId: 'u_wall_south', kind: 'window', offset: 0.22, width: 1.7 },
    { id: 'u_win_south_b', wallId: 'u_wall_south', kind: 'window', offset: 0.78, width: 1.4 },
    { id: 'u_win_north_a', wallId: 'u_wall_north', kind: 'window', offset: 0.2, width: 1.8 },
    { id: 'u_win_north_b', wallId: 'u_wall_north', kind: 'window', offset: 0.68, width: 2.2 },
    { id: 'u_win_west', wallId: 'u_wall_west', kind: 'window', offset: 0.5, width: 1.3 },
    { id: 'u_win_east', wallId: 'u_wall_east', kind: 'window', offset: 0.48, width: 1.5 },
  ];

  const furniture: Furniture[] = [
    {
      id: 'u_bed_left',
      kind: 'bed',
      name: '次卧双人床',
      x: 2.55,
      y: 1.7,
      rotation: 0,
      width: 1.8,
      depth: 2.05,
      color: '#c9b8a4',
      items: [{ id: 'u_i_quilt', name: '备用羽绒被', quantity: 2, note: '床下收纳袋' }],
    },
    {
      id: 'u_night_left',
      kind: 'nightstand',
      name: '次卧床头柜',
      x: 1.35,
      y: 0.72,
      rotation: 0,
      width: 0.5,
      depth: 0.45,
      color: '#b08f6e',
      items: [
        { id: 'u_i_book', name: '睡前读物', quantity: 3, note: '上层抽屉' },
        { id: 'u_i_glasses', name: '备用眼镜', quantity: 1, note: '' },
      ],
    },
    {
      id: 'u_bed_right',
      kind: 'bed',
      name: '主卧双人床',
      x: 8.6,
      y: 2.1,
      rotation: 0,
      width: 1.7,
      depth: 2.0,
      color: '#bca993',
      items: [{ id: 'u_i_heater', name: '暖炉', quantity: 1, note: '床下第二个箱子' }],
    },
    {
      id: 'u_cab_right',
      kind: 'cabinet',
      name: '主卧衣柜',
      x: 12.55,
      y: 4.6,
      rotation: -Math.PI / 2,
      width: 1.8,
      depth: 0.52,
      color: '#7c8fa6',
      items: [
        { id: 'u_i_coat', name: '冬季大衣', quantity: 4, note: '防尘罩' },
        { id: 'u_i_luggage', name: '旅行背包', quantity: 1, note: '顶柜' },
      ],
    },
    {
      id: 'u_desk',
      kind: 'table',
      name: '阁楼书桌',
      x: 7.6,
      y: 5.8,
      rotation: 0,
      width: 1.7,
      depth: 0.8,
      color: '#8f684c',
      items: [
        { id: 'u_i_notes', name: '手账本', quantity: 2, note: '抽屉里' },
        { id: 'u_i_pen', name: '钢笔礼盒', quantity: 1, note: '' },
      ],
    },
    {
      id: 'u_cab_top',
      kind: 'cabinet',
      name: '阁楼储物柜',
      x: 10.6,
      y: 6.35,
      rotation: Math.PI,
      width: 1.5,
      depth: 0.48,
      color: '#6f7b70',
      items: [{ id: 'u_i_deco', name: '节日装饰', quantity: 2, note: '下层左侧' }],
    },
  ];

  return {
    id: 'floor_wutong_2',
    name: floorName(level),
    level,
    shapes,
    walls,
    openings,
    furniture,
    stairs: [],
  };
}

function studioHouse(): House {
  const level = 0;
  const floor: FloorPlan = {
    id: 'floor_studio_1',
    name: floorName(level),
    level,
    shapes: [
      {
        id: 's_shape_main',
        kind: 'rect',
        x: 0,
        y: 0,
        width: 7.2,
        height: 5.4,
        rotation: 0,
        mode: 'union',
      },
      {
        id: 's_shape_bay',
        kind: 'ellipse',
        x: 5.0,
        y: 0.2,
        width: 2.2,
        height: 2.2,
        rotation: 0,
        mode: 'union',
      },
    ],
    walls: [
      { id: 's_wall_south', a: { x: 0, y: 0 }, b: { x: 7.2, y: 0 }, thickness: 0.22 },
      { id: 's_wall_east', a: { x: 7.2, y: 0 }, b: { x: 7.2, y: 5.4 }, thickness: 0.22 },
      { id: 's_wall_north', a: { x: 7.2, y: 5.4 }, b: { x: 0, y: 5.4 }, thickness: 0.22 },
      { id: 's_wall_west', a: { x: 0, y: 5.4 }, b: { x: 0, y: 0 }, thickness: 0.22 },
      { id: 's_wall_partition', a: { x: 4.4, y: 3.2 }, b: { x: 7.2, y: 3.2 }, thickness: 0.14 },
    ],
    openings: [
      { id: 's_door_entry', wallId: 's_wall_south', kind: 'door', offset: 0.28, width: 1.0 },
      { id: 's_win_south', wallId: 's_wall_south', kind: 'window', offset: 0.7, width: 1.8 },
      { id: 's_win_west', wallId: 's_wall_west', kind: 'window', offset: 0.55, width: 1.6 },
      { id: 's_win_north', wallId: 's_wall_north', kind: 'window', offset: 0.35, width: 2.0 },
      { id: 's_door_bath', wallId: 's_wall_partition', kind: 'door', offset: 0.55, width: 0.8 },
    ],
    furniture: [
      {
        id: 's_desk',
        kind: 'table',
        name: '工作台',
        x: 2.0,
        y: 2.4,
        rotation: 0,
        width: 1.9,
        depth: 0.9,
        color: '#8f684c',
        items: [
          { id: 's_i_camera', name: '备用相机', quantity: 1, note: '右侧抽屉' },
          { id: 's_i_drive', name: '素材硬盘', quantity: 2, note: '贴着绿色标签' },
        ],
      },
      {
        id: 's_sofa',
        kind: 'sofa',
        name: '窗边沙发',
        x: 2.2,
        y: 4.4,
        rotation: Math.PI,
        width: 1.9,
        depth: 0.85,
        color: '#a58b9e',
        items: [{ id: 's_i_throw', name: '羊毛毯', quantity: 1, note: '搭在扶手上' }],
      },
      {
        id: 's_cab',
        kind: 'cabinet',
        name: '样品柜',
        x: 5.9,
        y: 4.3,
        rotation: Math.PI,
        width: 1.4,
        depth: 0.48,
        color: '#7f927f',
        items: [
          { id: 's_i_sample', name: '材料样品册', quantity: 6, note: '按色系排列' },
          { id: 's_i_tool', name: '精密螺丝刀', quantity: 1, note: '' },
        ],
      },
      {
        id: 's_bed',
        kind: 'bed',
        name: '午休床',
        x: 5.6,
        y: 1.45,
        rotation: 0,
        width: 1.4,
        depth: 1.95,
        color: '#bca993',
        items: [{ id: 's_i_pillow', name: '旅行枕', quantity: 1, note: '' }],
      },
    ],
    stairs: [],
  };

  return {
    id: 'house_studio',
    name: '河畔工作室',
    floors: [floor],
  };
}

/** A complete workspace with two houses, a two-storey home and a stair. */
export function createDemoWorkspace(): Workspace {
  const groundShapes: FloorShape[] = [
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

  const groundWalls: Wall[] = [
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

  const groundOpenings: Opening[] = [
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

  const groundFurniture: Furniture[] = [
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

  const stairs: Stair[] = [
    {
      id: 'stair_main',
      x: 4.55,
      y: 1.5,
      width: STAIR_DEFAULTS.width,
      depth: 2.8,
      rotation: 0,
      steps: STAIR_DEFAULTS.steps,
    },
  ];

  const ground: FloorPlan = {
    id: 'floor_wutong_1',
    name: floorName(0),
    level: 0,
    shapes: groundShapes,
    walls: groundWalls,
    openings: groundOpenings,
    furniture: groundFurniture,
    stairs,
  };

  return {
    schemaVersion: 2,
    id: 'workspace_home',
    revision: 1,
    updatedAt: now(),
    houses: [
      {
        id: 'house_wutong',
        name: '梧桐宅',
        floors: [ground, upperFloor()],
      },
      studioHouse(),
    ],
  };
}
