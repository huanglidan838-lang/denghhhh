export type PhotoRegionId = "yunnan" | "western-sichuan" | "xinjiang" | "fujian";

export type TravelPhoto = {
  id: string;
  src: string;
  alt: string;
  groupId: string;
  groupTitle: string;
  index: number;
};

export type PhotoRegionGroup = {
  id: string;
  title: string;
  en: string;
  description: string;
  indices: number[];
};

export type PhotoRegion = {
  id: PhotoRegionId;
  title: string;
  en: string;
  kicker: string;
  description: string;
  accent: string;
  cover: string;
  groups: PhotoRegionGroup[];
  photos: TravelPhoto[];
};

const makeRegion = (
  id: PhotoRegionId,
  title: string,
  en: string,
  kicker: string,
  description: string,
  accent: string,
  coverIndex: number,
  groups: PhotoRegionGroup[],
): PhotoRegion => {
  const indexToGroup = new Map<number, PhotoRegionGroup>();
  groups.forEach((group) => group.indices.forEach((index) => indexToGroup.set(index, group)));
  const count = groups.reduce((total, group) => total + group.indices.length, 0);
  const photos = Array.from({ length: count }, (_, offset) => {
    const index = offset + 1;
    const group = indexToGroup.get(index)!;
    return {
      id: `${id}-${String(index).padStart(2, "0")}`,
      src: `/portfolio/travel/${id}-${String(index).padStart(2, "0")}.webp`,
      alt: `${title}摄影：${group.title} ${String(index).padStart(2, "0")}`,
      groupId: group.id,
      groupTitle: group.title,
      index,
    };
  });
  return {
    id,
    title,
    en,
    kicker,
    description,
    accent,
    cover: `/portfolio/travel/${id}-${String(coverIndex).padStart(2, "0")}.webp`,
    groups,
    photos,
  };
};

export const PHOTO_REGIONS: PhotoRegion[] = [
  makeRegion(
    "yunnan",
    "云南",
    "YUNNAN",
    "古城、花木与湖岸",
    "从老城屋檐望向远山，在花树、夕照与湖岸之间记录缓慢而温暖的日常。镜头保留建筑的时间痕迹，也收下旅途中偶然出现的人与光。",
    "#d9a09b",
    4,
    [
      { id: "old-town", title: "古城建筑", en: "OLD TOWN", description: "门洞、木楼与石墙构成层叠的在地空间。", indices: [1, 3] },
      { id: "botanical-light", title: "花木光影", en: "BOTANICAL LIGHT", description: "花树与夕阳让古城显出柔软的季节感。", indices: [2, 4, 5] },
    ],
  ),
  makeRegion(
    "western-sichuan",
    "川西",
    "WESTERN SICHUAN",
    "雪山、草甸与高原公路",
    "沿高原公路穿行，雪山、湖泊与草甸在天气里不断切换。远景强调川西的辽阔尺度，近处的经幡、营地与骑行者则留下旅途温度。",
    "#9db8c8",
    1,
    [
      { id: "snow-lakes", title: "雪山湖泊", en: "MOUNTAINS & LAKES", description: "雪线、山脊与湖面组成高原最安静的层次。", indices: [1, 2, 3, 6, 7, 12] },
      { id: "plateau-life", title: "草原人文", en: "PLATEAU LIFE", description: "经幡、村落、牧人与马匹记录高原上的生活切片。", indices: [4, 8, 9, 11] },
      { id: "road-light", title: "公路光影", en: "ROAD & LIGHT", description: "车窗、路标与日落构成一段不断前行的观看。", indices: [5, 10] },
    ],
  ),
  makeRegion(
    "xinjiang",
    "新疆",
    "XINJIANG",
    "湖泊、牧场、木屋与森林",
    "北疆的夏日拥有清澈而丰富的颜色：湖泊映着雪山，牛羊穿过草场，木屋藏在云影与松林之间。组照以自然尺度为主线，也保留沿途生活的细节。",
    "#9ebc91",
    18,
    [
      { id: "lakes-wetlands", title: "湖泊湿地", en: "LAKES & WETLANDS", description: "蓝绿色湖面、河曲与天鹅共同呈现流动的水域景观。", indices: [1, 6, 8, 9, 15, 18, 19] },
      { id: "pastoral", title: "草原牧歌", en: "PASTORAL", description: "牧场、牛羊、马匹与毡房构成富有生命力的辽阔日常。", indices: [3, 4, 7, 21, 23] },
      { id: "village-life", title: "木屋村落", en: "VILLAGE LIFE", description: "木屋、院落与沿途小店保留旅行中的居住与人文线索。", indices: [2, 11, 12, 14, 16, 17] },
      { id: "forest-weather", title: "山林天光", en: "FOREST & WEATHER", description: "松林、云雾与骤雨让山谷呈现更深的光影层次。", indices: [5, 10, 13, 20, 22] },
    ],
  ),
  makeRegion(
    "fujian",
    "福建",
    "FUJIAN",
    "海岸、街区与日常设计",
    "从滨海生活到城市街区，画面以清透蓝调、松弛人物和局部建筑细节，记录熟悉地域里仍不断变化的光线。",
    "#a9c8bd",
    9,
    [
      { id: "coastal-life", title: "滨海日常", en: "COASTAL LIFE", description: "海岸、沙滩与人物共同构成轻松明亮的沿海生活。", indices: [2, 5, 6, 7, 9] },
      { id: "city-walk", title: "城市漫游", en: "CITY WALK", description: "街景、骑行与建筑切片呈现城市里具体的观看路径。", indices: [1, 3] },
      { id: "designed-light", title: "设计光影", en: "DESIGNED LIGHT", description: "风车与室内空间用简洁结构连接自然光和设计感。", indices: [4, 8] },
    ],
  ),
];

export const photoRegionById = (id: string) =>
  PHOTO_REGIONS.find((region) => region.id === id);

export type PhotoCollection = {
  id: "portrait-photo" | "product-photo";
  title: string;
  en: string;
  description: string;
  accent: string;
  cover: string;
  groups: PhotoRegionGroup[];
  photos: TravelPhoto[];
};

const makeCollection = (
  id: PhotoCollection["id"], title: string, en: string, description: string,
  accent: string, count: number, coverIndex: number, groups: PhotoRegionGroup[],
): PhotoCollection => {
  const prefix = id === "portrait-photo" ? "portrait" : "product";
  const groupByIndex = new Map<number, PhotoRegionGroup>();
  groups.forEach((group) => group.indices.forEach((index) => groupByIndex.set(index, group)));
  const photos = Array.from({ length: count }, (_, offset) => {
    const index = offset + 1;
    const group = groupByIndex.get(index)!;
    return { id: `${prefix}-${String(index).padStart(2, "0")}`, src: `/portfolio/photo-archive/${prefix}-${String(index).padStart(2, "0")}.webp`, alt: `${title}：${group.title} ${index}`, groupId: group.id, groupTitle: group.title, index };
  });
  return { id, title, en, description, accent, cover: `/portfolio/photo-archive/${prefix}-${String(coverIndex).padStart(2, "0")}.webp`, groups, photos };
};

export const PHOTO_COLLECTIONS: PhotoCollection[] = [
  makeCollection("portrait-photo", "人像摄影", "PORTRAIT", "以人物气质与色彩关系为线索，从自然光日常、奶油复古到高对比戏剧氛围，保留不同造型的情绪张力。", "#d9a09b", 13, 10, [
    { id: "warm-retro", title: "暖调复古", en: "WARM RETRO", description: "奶油、粉色与柔光塑造细腻安静的复古肖像。", indices: [3, 5, 7, 8, 10] },
    { id: "fresh-natural", title: "清新自然", en: "FRESH & NATURAL", description: "自然光与户外环境让人物状态更加松弛、轻盈。", indices: [2, 4, 11, 12, 13] },
    { id: "dramatic-color", title: "戏剧色彩", en: "DRAMATIC COLOR", description: "红黑对比与角色造型强化画面的叙事感和视觉冲击。", indices: [1, 6, 9] },
  ]),
  makeCollection("product-photo", "产品摄影", "PRODUCT", "围绕餐饮品牌的食物造型、色彩与传播场景展开，以俯拍、暖调静物和菜单视觉呈现产品质感。", "#dec17a", 15, 14, [
    { id: "gongniu", title: "功牛本家", en: "GONGNIU BENJIA", description: "围绕餐饮品牌菜单与传播场景，用近景质感和版式组合建立统一的商业视觉。", indices: [9, 10, 15] },
    { id: "linyu", title: "麟屿", en: "LINYU", description: "以明亮鲜活的餐食色彩、俯拍构图和统一餐具关系，整理成一组更具食欲感的品牌作品。", indices: [3, 5, 8, 11, 13] },
    { id: "warm-table", title: "暖调氛围", en: "WARM TABLE", description: "柔暖光线、木色和近景构图强化食物的温度与香气。", indices: [1, 2, 4, 6, 7, 12, 14] },
  ]),
];

export const photoCollectionById = (id: string) => PHOTO_COLLECTIONS.find((collection) => collection.id === id);
