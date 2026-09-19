export type FolderId = "brand" | "long" | "visual" | "photo";
export type ProjectKind = "brand" | "long" | "poster" | "app" | "meitu" | "aigc" | "photo" | "handmade";
export type VisualFilter = "all" | "poster" | "app" | "meitu" | "photo" | "aigc" | "handmade";

export type SlideAsset = { page: number; src: string; alt: string; label?: string };
export type Project = { id: string; folder: FolderId; kind: ProjectKind; title: string; en: string; summary: string; tags: string[]; pages: number[]; cover: string };
export type FolderCategory = { id: FolderId; en: string; cn: string; note: string; color: string; coverPage: number };

const page = (n: number) => `/portfolio/pages/page-${String(n).padStart(2, "0")}.webp`;
const updatedPage = (n: number) => `/portfolio/updated/page-${String(n).padStart(2, "0")}.webp`;

export const PROFILE = {
  name: "邓海玲", location: "福建厦门", birthday: "2001 年 10 月 5 日", phone: "18805908864", email: "1350337765@qq.com",
  education: "福州大学 · 硕士研究生", major: "视觉传达设计（本科 / 硕士）",
  educationHistory: [
    { date: "2024.09–2027.06", school: "福州大学", degree: "视觉传达设计（硕士）" },
    { date: "2020.09–2024.06", school: "福建农林大学金山学院", degree: "视觉传达设计（本科）" },
  ],
  courses: ["平面设计", "UI 设计", "包装设计", "品牌设计", "摄影"],
  ranking: "专业成绩前 2%",
  awards: ["2022–2024 连续三年全国大学生广告设计大赛二等奖", "2024 中国包装创意设计大赛一等奖", "本科期间连续四年专业排名第一"],
  experience: [
    {
      date: "2021.09–2022.06", company: "福州镜归文化创意有限公司", role: "设计实习生",
      details: ["根据客户需求设计品牌视觉、活动宣传等创意平面作品", "指导新成员熟悉工作流程并协助团队顺畅协作", "创作并优化产品宣传海报，参与重要项目并把控设计质量", "与客户沟通，将设计需求转化为具体创意方案"],
    },
    {
      date: "2025.01–2025.07", company: "三麟中泰实业有限公司", role: "设计实习生",
      details: ["负责实体餐饮店“麟屿”两套 UI 方案、图标与 Logo 设计", "负责产品日常拍摄，为公众号、小程序等页面提供素材", "承担产品包装更新及公众号、小红书、微博海报设计", "负责拼多多、天猫、京东旗舰店主图的日常更新"],
    },
    {
      date: "2025.08–2026.03", company: "美图公司", role: "AIGC 设计实习生",
      details: ["体验影像类产品的素材玩法与效果，洞察流行创意趋势", "测评热门 AI 项目的功能与效果", "定期产出 APP 相关功能项目"],
    },
  ],
  campusPractice: {
    date: "2021.09–2024.06",
    school: "福建农林大学金山学院",
    role: "融媒体办公室影视部组长",
    details: ["维护栏目内容，编辑新闻报道视频与图片并及时上传发布", "负责宣传印刷品的内容采集、整理、编辑、版面设计与组织工作"],
  },
  interests: ["绘画", "摄影", "手工", "陶艺", "运动"],
  qualifications: [
    "英语 CET4，熟练掌握日常沟通；善于矢量图制作，具备较强手绘能力",
    "熟练使用 AI、PS、Figma，掌握 AE、PR 后期剪辑软件与 AIGC 项目；熟悉办公软件，计划能力强，善于总结并能适应复杂工作环境",
    "喜欢传统文化，擅长手绘与建模，善于提炼、整合传统文化设计元素",
  ],
};

export const SKILLS = [
  { no: "01", en: "VISUAL DESIGN", cn: "视觉设计", desc: "品牌、排版、插画与视觉物料系统。", tools: ["Photoshop", "Illustrator", "InDesign", "品牌视觉", "版式设计"], color: "#b9d9ee" },
  { no: "02", en: "UI & INTERACTION", cn: "界面与交互", desc: "信息架构、界面流程与高保真呈现。", tools: ["Figma", "APP UI", "交互原型", "信息架构"], color: "#f2cad7" },
  { no: "03", en: "PHOTOGRAPHY", cn: "摄影与图像", desc: "产品、风光、人像拍摄与后期处理。", tools: ["产品摄影", "风光摄影", "人像摄影", "后期修图"], color: "#c4dfb8" },
  { no: "04", en: "AIGC PRACTICE", cn: "AIGC 设计", desc: "生成式图像、提示词与设计流程实验。", tools: ["生成式图像", "提示词设计", "视觉实验", "创意提案"], color: "#f2dfa0" },
] as const;

export const FOLDERS: FolderCategory[] = [
  { id: "visual", en: "VISUAL DESIGN", cn: "视觉设计", note: "视觉设计", color: "#acd7f2", coverPage: 25 },
  { id: "brand", en: "BRAND DESIGN", cn: "品牌设计", note: "品牌设计", color: "#f0c0d1", coverPage: 4 },
  { id: "long", en: "LONG IMAGE", cn: "长图设计", note: "长图设计", color: "#b9dca9", coverPage: 18 },
  { id: "photo", en: "OTHER DESIGN", cn: "其他设计", note: "其他设计", color: "#f1d889", coverPage: 39 },
];

export const VISUAL_FILTERS: { id: VisualFilter; label: string }[] = [
  { id: "all", label: "全部" }, { id: "meitu", label: "美图项目" }, { id: "poster", label: "海报" }, { id: "app", label: "APP 和 UI" },
];

export const OTHER_FILTERS: { id: VisualFilter; label: string }[] = [
  { id: "all", label: "全部" }, { id: "photo", label: "摄影作品" }, { id: "aigc", label: "AIGC 设计" }, { id: "handmade", label: "手作设计" },
];

const makeProject = (id: string, folder: FolderId, kind: ProjectKind, title: string, en: string, summary: string, tags: string[], pages: number[], cover = `/portfolio/covers/${id}.webp`): Project => ({ id, folder, kind, title, en, summary, tags, pages, cover });

const PROJECT_ORDER: Record<string, number> = {
  "meitu-qoo": 5,
  "meitu-xiaoba": 9,
  "meitu-fish": 11,
  "meitu-doodle": 13,
  "meitu-arrival": 15,
  "meitu-year-card": 17,
  "meitu-exam": 19,
  "meitu-student": 21,
  "meitu-survey": 23,
  nushu: 25,
  kawei: 29,
  linyu: 32,
  xiangcheng: 34,
  wanli: 37,
  jiedian: 44,
  "mittoto-stickers": 49,
  "sanlin-coconut": 51,
  "sanlin-soda": 53,
  "fzu-letter": 54,
  "meitu-image-festival": 57,
  aigc: 59,
  handmade: 60,
  "product-photo": 61,
  "portrait-photo": 62,
  "landscape-photo": 63,
};

export const PROJECTS: Project[] = [
  makeProject("jiedian", "brand", "brand", "0界点", "JIE DIAN", "围绕节气、点心与城市日常建立的插画品牌系统。", ["品牌识别", "插画", "包装", "物料延展"], [44, 45, 46, 47, 48], updatedPage(44)),
  makeProject("wanli", "brand", "brand", "万里茶山", "WANLI TEA MOUNTAIN", "以闽南茶饮与在地风物为线索的完整品牌叙事。", ["茶饮品牌", "空间视觉", "产品插画", "菜单"], [37, 38, 39, 40, 41, 42, 43], "/portfolio/updated/wanli-cover.webp"),
  makeProject("mittoto-stickers", "brand", "brand", "Mittoto 贴纸设计", "MITTOTO STICKERS", "围绕角色形象完成的轻盈贴纸视觉与周边延展。", ["角色设计", "贴纸", "周边"], [49], updatedPage(49)),
  makeProject("sanlin-coconut", "long", "long", "三麟椰子水营销长图", "SANLIN COCONUT WATER", "围绕打工人补水场景设计的椰子水社交媒体长图。", ["长图", "椰子水", "社交传播", "营销视觉"], [51, 52], updatedPage(51)),
  makeProject("sanlin-soda", "long", "long", "三麟气泡水营销长图", "SANLIN SODA WATER", "以春日调饮和青团搭配为主题的气泡水移动端长图。", ["长图", "气泡水", "移动端", "营销视觉"], [53], updatedPage(53)),
  makeProject("fzu-letter", "long", "long", "2025 福州大学录取通知书", "FZU ADMISSION LETTER", "以福州城市文化和校园建筑为核心的折页式通知书方案。", ["文创", "折页", "校园文化", "信息设计"], [54, 55], updatedPage(54)),
  makeProject("nushu", "visual", "poster", "江永女书系列", "JIANGYONG NÜSHU", "以江永女书文字结构与女性叙事为灵感的系列设计。", ["文化海报", "字体实验", "周边", "日历"], [25, 26, 27, 28], updatedPage(25)),
  makeProject("kawei", "visual", "poster", "咖位咖啡系列", "KAWEI COFFEE", "把咖啡风味与日常人物场景组合成系列插画海报。", ["咖啡", "系列海报", "插画", "包装"], [29, 30, 31], updatedPage(29)),
  makeProject("linyu", "visual", "app", "麟屿 APP", "LINYU APP", "以餐饮发现、菜单浏览和下单为核心的移动端服务体验。", ["APP", "餐饮服务", "UI", "流程设计"], [32, 33], updatedPage(32)),
  makeProject("xiangcheng", "visual", "app", "享氢APP", "XIANGQING APP", "面向生活内容与成长服务的柔和色彩移动端界面。", ["APP", "信息架构", "UI", "数据展示"], [34, 35], updatedPage(34)),
  makeProject("meitu-qoo", "visual", "meitu", "美图秀秀x酷儿联名", "MEITU X QOO", "围绕酷儿角色与秋日主题完成的系列联动视觉。", ["美图项目", "IP 联动", "系列视觉"], [6, 5, 7, 8], updatedPage(6)),
  makeProject("meitu-fish", "visual", "meitu", "美图秀秀x路人鱼联名", "MEITU X INCIDENTAL FISH", "围绕路人鱼形象设计的联动换装主题活动。", ["美图项目", "IP 联动", "换装玩法"], [11, 12], updatedPage(11)),
  makeProject("meitu-xiaoba", "visual", "meitu", "美图秀秀x幸运小八联名", "MEITU X LUCKY XIAOBA", "以幸运小八角色为核心的主题活动视觉设计。", ["美图项目", "IP 角色", "主题活动"], [9, 10], updatedPage(9)),
  makeProject("meitu-exam", "visual", "meitu", "China Joy美图大考", "CHINA JOY MEITU QUIZ", "以趣味测试为线索组织的专题活动视觉与页面设计。", ["美图项目", "趣味测试", "专题设计"], [19, 20], updatedPage(19)),
  makeProject("meitu-year-card", "visual", "meitu", "美图秀秀xTop Barry年卡", "MEITU X TOP BARRY ANNUAL PASS", "围绕联合会员年卡完成的活动主视觉与页面呈现。", ["美图项目", "活动视觉", "会员营销"], [17, 18], updatedPage(17)),
  makeProject("meitu-arrival", "visual", "meitu", "Top Barry来了", "TOP BARRY IS HERE", "围绕素材专区上线完成的宣传主视觉与项目展示。", ["美图项目", "素材专区", "运营视觉"], [15, 16], updatedPage(15)),
  makeProject("meitu-doodle", "visual", "meitu", "搞怪涂鸦特效", "PLAYFUL DOODLE EFFECT", "结合手绘涂鸦语言完成的趣味影像主题活动。", ["美图项目", "涂鸦", "影像玩法"], [13, 14], updatedPage(13)),
  makeProject("meitu-survey", "visual", "meitu", "1分钟调研", "ONE-MINUTE SURVEY", "将用户调研流程转化为轻松清晰的活动视觉。", ["美图项目", "用户调研", "问卷活动"], [23, 24], updatedPage(23)),
  makeProject("meitu-student", "visual", "meitu", "学生特惠", "STUDENT OFFER", "面向学生用户的优惠活动视觉与移动端页面方案。", ["美图项目", "学生特惠", "活动页面"], [21, 22], updatedPage(21)),
  makeProject("meitu-image-festival", "photo", "aigc", "2026 美图影像节", "MEITU IMAGING FESTIVAL", "记录美图影像节现场视觉、空间装置与活动体验。", ["美图项目", "活动视觉", "影像节"], [57, 58], updatedPage(57)),
  makeProject("aigc", "photo", "aigc", "AIGC 设计实践", "AIGC DESIGN", "围绕人物与场景生成开展的视觉实验与结果筛选。", ["AIGC", "人物生成", "视觉实验"], [], "/portfolio/updated/aigc-design.webp"),
  makeProject("handmade", "photo", "handmade", "手作设计", "HANDMADE DESIGN", "以布艺、刺绣、陶艺与生活器物为载体，记录材料、图案和手工温度。", ["手作", "布艺", "陶艺", "刺绣"], [], "/portfolio/updated/handmade-design.webp"),
  makeProject("product-photo", "photo", "photo", "产品摄影", "PRODUCT PHOTOGRAPHY", "以食物质感、光线和版式结合完成的商业产品图像。", ["摄影", "食品", "商业视觉"], [], "/portfolio/updated/product-photography.webp"),
  makeProject("landscape-photo", "photo", "photo", "风光摄影", "LANDSCAPE PHOTOGRAPHY", "湖面、山地、海岸与城市日常构成的风光观察。", ["摄影", "风光", "旅行"], [], "/portfolio/updated/landscape-photography.webp"),
  makeProject("portrait-photo", "photo", "photo", "人像摄影", "PORTRAIT PHOTOGRAPHY", "通过自然环境、布光与造型呈现不同气质的人像组照。", ["摄影", "人像", "造型"], [], "/portfolio/updated/portrait-photography.webp"),
]
  .map((project) => ({ ...project, cover: `/portfolio/thumbs/${project.id}.webp` }))
  .sort((a, b) => PROJECT_ORDER[a.id] - PROJECT_ORDER[b.id]);

const customSlides: Partial<Record<string, SlideAsset[]>> = {
  handmade: [
    { page: 0, label: "01", src: "/portfolio/handcraft/handcraft-01.webp", alt: "手作设计：陶艺与缝纫作品合集" },
  ],
  "meitu-year-card": [
    { page: 0, label: "01", src: "/portfolio/meitu/meitu-year-card-01.webp", alt: "美图秀秀xTop Barry年卡项目主视觉" },
    { page: 0, label: "02", src: "/portfolio/meitu/meitu-year-card-02.webp", alt: "美图秀秀xTop Barry年卡项目展示" },
  ],
  "meitu-arrival": [
    { page: 0, label: "01", src: "/portfolio/meitu/meitu-arrival-01.webp", alt: "Top Barry来了项目主视觉" },
  ],
  "meitu-student": [
    { page: 0, label: "01", src: "/portfolio/meitu/meitu-student-02.webp", alt: "学生特惠项目主视觉" },
    { page: 0, label: "02", src: "/portfolio/meitu/meitu-student-01.webp", alt: "学生特惠项目展示" },
  ],
  "meitu-xiaoba": [
    { page: 0, label: "01", src: "/portfolio/meitu/meitu-xiaoba-01.webp", alt: "美图秀秀x幸运小八联名项目主视觉" },
    { page: 0, label: "02", src: "/portfolio/meitu/meitu-xiaoba-02.webp", alt: "美图秀秀x幸运小八联名项目展示" },
  ],
  "meitu-doodle": [
    { page: 0, label: "01", src: "/portfolio/meitu/meitu-doodle-02.webp", alt: "搞怪涂鸦特效项目主视觉" },
    { page: 0, label: "02", src: "/portfolio/meitu/meitu-doodle-01.webp", alt: "搞怪涂鸦特效项目展示" },
  ],
  "meitu-exam": [
    { page: 0, label: "01", src: "/portfolio/meitu/meitu-exam-02.webp", alt: "China Joy美图大考项目主视觉" },
    { page: 0, label: "02", src: "/portfolio/meitu/meitu-exam-01.webp", alt: "China Joy美图大考项目展示" },
  ],
  "meitu-survey": [
    { page: 0, label: "01", src: "/portfolio/meitu/meitu-survey-01.webp", alt: "1分钟调研项目主视觉" },
    { page: 0, label: "02", src: "/portfolio/meitu/meitu-survey-02.webp", alt: "1分钟调研项目展示" },
  ],
  "meitu-fish": [
    { page: 0, label: "01", src: "/portfolio/meitu/meitu-fish-02.webp", alt: "美图秀秀x路人鱼联名项目主视觉" },
    { page: 0, label: "02", src: "/portfolio/meitu/meitu-fish-01.webp", alt: "美图秀秀x路人鱼联名项目展示" },
  ],
  "meitu-qoo": [
    { page: 0, label: "01", src: "/portfolio/meitu/meitu-qoo-01.webp", alt: "美图秀秀x酷儿联名项目介绍" },
    { page: 0, label: "02", src: "/portfolio/meitu/meitu-qoo-02.webp", alt: "美图秀秀x酷儿联名项目主视觉" },
    { page: 0, label: "03", src: "/portfolio/meitu/meitu-qoo-03.webp", alt: "美图秀秀x酷儿联名项目页面展示" },
    { page: 0, label: "04", src: "/portfolio/meitu/meitu-qoo-04.webp", alt: "美图秀秀x酷儿联名项目延展设计" },
  ],
  "product-photo": [
    { page: 39, label: "01", src: "/portfolio/photography/product-01.webp", alt: "产品摄影：萝卜饭" },
    { page: 39, label: "02", src: "/portfolio/photography/product-02.webp", alt: "产品摄影：红烧牛肉面" },
    { page: 39, label: "03", src: "/portfolio/photography/product-03.webp", alt: "产品摄影：牛排小菜" },
    { page: 39, label: "04", src: "/portfolio/photography/product-04.webp", alt: "产品摄影：捞汁金钱肚" },
  ],
  "landscape-photo": [
    { page: 40, label: "01", src: "/portfolio/photography/landscape-01.webp", alt: "风光摄影：湖畔天鹅" },
    { page: 40, label: "02", src: "/portfolio/photography/landscape-02.webp", alt: "风光摄影：高原滑翔伞" },
    { page: 40, label: "03", src: "/portfolio/photography/landscape-03.webp", alt: "风光摄影：游乐场纪实" },
    { page: 40, label: "04", src: "/portfolio/photography/landscape-04.webp", alt: "风光摄影：海岸与风车" },
  ],
  "portrait-photo": [
    { page: 41, label: "01", src: "/portfolio/photography/portrait-01.webp", alt: "人像摄影：春日花下写真" },
    { page: 41, label: "02", src: "/portfolio/photography/portrait-02.webp", alt: "人像摄影：户外婚纱写真" },
    { page: 41, label: "03", src: "/portfolio/photography/portrait-03.webp", alt: "人像摄影：海边白裙写真" },
    { page: 41, label: "04", src: "/portfolio/photography/portrait-04.webp", alt: "人像摄影：室内复古婚纱写真" },
  ],
};

const numberedUpdatedSlides = (projectTitle: string, pages: number[]): SlideAsset[] =>
  pages.map((n, index) => ({
    page: n,
    label: String(index + 1).padStart(2, "0"),
    src: updatedPage(n),
    alt: `${projectTitle}作品展示，第 ${index + 1} 页`,
  }));

// The September portfolio handoff is already numbered by the designer. Keep
// each project range explicit so filesystem ordering can never scramble pages.
const updatedProjectSlides: Partial<Record<string, SlideAsset[]>> = {
  "meitu-qoo": numberedUpdatedSlides("美图秀秀x酷儿联名", [6, 5, 7, 8]),
  "meitu-xiaoba": numberedUpdatedSlides("美图秀秀x幸运小八联名", [9, 10]),
  "meitu-fish": numberedUpdatedSlides("美图秀秀x路人鱼联名", [11, 12]),
  "meitu-doodle": numberedUpdatedSlides("搞怪涂鸦特效", [13, 14]),
  "meitu-arrival": numberedUpdatedSlides("Top Barry来了", [15, 16]),
  "meitu-year-card": numberedUpdatedSlides("美图秀秀xTop Barry年卡", [17, 18]),
  "meitu-exam": numberedUpdatedSlides("China Joy美图大考", [19, 20]),
  "meitu-student": numberedUpdatedSlides("学生特惠", [21, 22]),
  "meitu-survey": numberedUpdatedSlides("1分钟调研", [23, 24]),
  nushu: numberedUpdatedSlides("江永女书系列", [25, 26, 27, 28]),
  kawei: numberedUpdatedSlides("咖位咖啡系列", [29, 30, 31]),
  linyu: numberedUpdatedSlides("麟屿 APP", [32, 33]),
  xiangcheng: numberedUpdatedSlides("享氢APP", [34, 35]),
  wanli: numberedUpdatedSlides("万里茶山", [37, 38, 39, 40, 41, 42, 43]),
  jiedian: numberedUpdatedSlides("0界点", [44, 45, 46, 47, 48]),
  "mittoto-stickers": numberedUpdatedSlides("Mittoto 贴纸设计", [49]),
  "sanlin-coconut": numberedUpdatedSlides("三麟椰子水营销长图", [51, 52]),
  "sanlin-soda": numberedUpdatedSlides("三麟气泡水营销长图", [53]),
  "fzu-letter": numberedUpdatedSlides("2025 福州大学录取通知书", [54, 55]),
  "meitu-image-festival": numberedUpdatedSlides("2026 美图影像节", [57, 58]),
  aigc: [{ page: 0, label: "01", src: "/portfolio/updated/aigc-design.webp", alt: "AIGC 设计实践作品展示" }],
  handmade: [{ page: 0, label: "01", src: "/portfolio/updated/handmade-design.webp", alt: "手作设计作品展示" }],
  "product-photo": [{ page: 0, label: "01", src: "/portfolio/updated/product-photography.webp", alt: "产品摄影作品展示" }],
  "portrait-photo": [{ page: 0, label: "01", src: "/portfolio/updated/portrait-photography.webp", alt: "人像摄影作品展示" }],
  "landscape-photo": [{ page: 0, label: "01", src: "/portfolio/updated/landscape-photography.webp", alt: "风光摄影作品展示" }],
};

export const slidesFor = (project: Project): SlideAsset[] =>
  updatedProjectSlides[project.id] ?? customSlides[project.id] ??
  project.pages.map((n) => ({ page: n, src: page(n), alt: `${project.title}作品展示，第 ${n} 页` }));
export const END_PAGE: SlideAsset = { page: 42, src: page(42), alt: "邓海玲 2026 作品集结束页" };
export const ALL_PAGES: SlideAsset[] = Array.from({ length: 42 }, (_, index) => ({ page: index + 1, src: page(index + 1), alt: `邓海玲 2026 作品集第 ${index + 1} 页` }));
export const CREDIT = { source: "https://github.com/qzz0518/locker-folio", origin: "https://www.xiaohongshu.com/discovery/item/6a852ae7000000002500b24e" };
