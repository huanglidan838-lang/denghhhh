import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the finished portfolio shell and metadata", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>PORTFOLIO 2026 · 邓海玲<\/title>/i);
  assert.match(html, /邓海玲/);
  assert.match(html, /邓海玲的空间/);
  assert.match(html, /欢迎光临/);
  assert.match(html, /xiangjiao-kuanmaoshualinggan\.ttf/);
  assert.match(html, /og\.png/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("ships the complete 42-page archive and portfolio data", async () => {
  const [content, photoArchive, packageJson, styles, pages, covers, photography, meitu, travel, curatedPhotos, handcraft, updated, thumbnails] = await Promise.all([
    readFile(new URL("../app/content.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/photoArchive.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readdir(new URL("../public/portfolio/pages/", import.meta.url)),
    readdir(new URL("../public/portfolio/covers/", import.meta.url)),
    readdir(new URL("../public/portfolio/photography/", import.meta.url)),
    readdir(new URL("../public/portfolio/meitu/", import.meta.url)),
    readdir(new URL("../public/portfolio/travel/", import.meta.url)),
    readdir(new URL("../public/portfolio/photo-archive/", import.meta.url)),
    readdir(new URL("../public/portfolio/handcraft/", import.meta.url)),
    readdir(new URL("../public/portfolio/updated/", import.meta.url)),
    readdir(new URL("../public/portfolio/thumbs/", import.meta.url)),
  ]);
  assert.equal(pages.filter((name) => /^page-\d{2}\.webp$/.test(name)).length, 42);
  assert.equal(covers.filter((name) => name.endsWith(".webp")).length, 21);
  assert.equal(photography.filter((name) => name.endsWith(".webp")).length, 12);
  assert.equal(meitu.filter((name) => name.endsWith(".webp")).length, 19);
  assert.equal(travel.filter((name) => name.endsWith(".webp")).length, 49);
  assert.equal(curatedPhotos.filter((name) => name.endsWith(".webp")).length, 28);
  assert.equal(handcraft.filter((name) => name.endsWith(".webp")).length, 1);
  assert.equal(updated.filter((name) => name.endsWith(".webp")).length, 64);
  assert.equal(thumbnails.filter((name) => name.endsWith(".webp")).length, 25);
  for (const region of ["云南", "川西", "新疆", "福建"]) assert.match(photoArchive, new RegExp(`"${region}"`));
  for (const category of ["古城建筑", "雪山湖泊", "草原牧歌", "木屋村落", "山林天光", "暖调复古", "清新自然", "戏剧色彩", "功牛本家", "麟屿", "暖调氛围"]) assert.match(photoArchive, new RegExp(`"${category}"`));
  assert.match(content, /18805908864/);
  assert.match(content, /1350337765@qq\.com/);
  assert.match(content, /"0界点"/);
  assert.match(content, /portfolio\/covers/);
  assert.match(content, /customSlides/);
  assert.equal((content.match(/\/portfolio\/photography\//g) ?? []).length, 12);
  assert.match(content, /福建农林大学金山学院/);
  assert.match(content, /融媒体办公室影视部组长/);
  assert.match(content, /专业成绩前 2%/);
  assert.match(content, /英语 CET4/);
  assert.match(content, /"享氢APP"/);
  for (const folder of ["brand", "long", "visual", "photo"]) {
    assert.match(content, new RegExp(`id: "${folder}"`));
  }
  for (const kind of ["poster", "app"]) assert.match(content, new RegExp(`makeProject\\([^\\n]+"visual", "${kind}"`));
  assert.match(content, /makeProject\("aigc", "photo", "aigc"/);
  assert.match(content, /label: "美图项目"/);
  assert.match(content, /label: "摄影作品"/);
  assert.match(content, /label: "AIGC 设计"/);
  assert.equal((content.match(/makeProject\(/g) ?? []).length, 25);
  assert.match(content, /"Mittoto 贴纸设计"/);
  assert.match(content, /"2026 美图影像节"/);
  assert.match(content, /"meitu-qoo": numberedUpdatedSlides\("美图秀秀x酷儿联名", \[6, 5, 7, 8\]\)/);
  assert.match(content, /"万里茶山"[\s\S]*?\/portfolio\/updated\/wanli-cover\.webp/);
  assert.match(content, /cover: `\/portfolio\/thumbs\/\$\{project\.id\}\.webp`/);
  assert.equal((content.match(/"visual", "meitu"/g) ?? []).length, 9);
  for (const title of ["美图秀秀xTop Barry年卡", "Top Barry来了", "学生特惠", "美图秀秀x幸运小八联名", "搞怪涂鸦特效", "China Joy美图大考", "1分钟调研", "美图秀秀x路人鱼联名", "美图秀秀x酷儿联名"]) {
    assert.match(content, new RegExp(`"${title}"`));
  }
  assert.deepEqual(
    [...content.matchAll(/makeProject\("meitu-[^"]+", "visual", "meitu", "([^"]+)"/g)].map((match) => match[1]),
    ["美图秀秀x酷儿联名", "美图秀秀x路人鱼联名", "美图秀秀x幸运小八联名", "China Joy美图大考", "美图秀秀xTop Barry年卡", "Top Barry来了", "搞怪涂鸦特效", "1分钟调研", "学生特惠"],
  );
  const experience = await readFile(new URL("../app/PortfolioExperience.tsx", import.meta.url), "utf8");
  assert.match(experience, /function FlatProjectGrid/);
  assert.match(experience, /项目平铺列表/);
  assert.match(experience, /className="flat-project-meta"/);
  assert.match(experience, /meitu: 0/);
  assert.match(content, /label: "美图项目" \}, \{ id: "poster"/);
  assert.match(experience, /打开\$\{project\.title\}项目并浏览全部页面/);
  assert.match(experience, />\s*点击查看\s*<\/button>/);
  assert.doesNotMatch(experience, /GradientProjectCarousel/);
  assert.match(experience, /archiveGroup\.position\.set\(3\.25, -0\.38 \+ mainDeskLift, 0\.08\)/);
  assert.match(experience, /keyboard\.position\.set\(-2\.45, -1\.58 \+ mainDeskLift, 0\.72\)/);
  assert.match(experience, /mouse\.position\.set\(-0\.45, -1\.55 \+ mainDeskLift, 1\.42\)/);
  assert.match(experience, /badgeRig\.position\.set\(0\.85, -1\.62 \+ mainDeskLift, 0\.95\)/);
  assert.match(experience, /plant\.position\.set\(4\.85, 0\.88, -2\.2\)/);
  assert.match(experience, /deskFrame\.scale\.setScalar\(0\.68\)/);
  assert.match(experience, /lamp\.position\.set\(-5\.35, -1\.75 \+ mainDeskLift, -0\.35\)/);
  assert.match(experience, /const rugPatches/);
  assert.match(experience, /portrait-13\.webp/);
  assert.match(content, /export const FOLDERS[\s\S]*?id: "visual"[\s\S]*?id: "brand"[\s\S]*?id: "long"[\s\S]*?id: "photo"/);
  assert.match(photoArchive, /15, 14/);
  assert.match(experience, /resumeTexture = loader\.load\("\/portfolio\/resume\.jpg"\)/);
  assert.match(experience, /new THREE\.ShapeGeometry\(flapShape\)/);
  assert.match(styles, /background:var\(--folder\)/);
  assert.match(experience, /const color = FOLDER_TONES\[folder\.id\]/);
  assert.match(styles, /left:50%;bottom:12px;translate:-50% 0/);
  assert.match(styles, /width:max-content/);
  assert.doesNotMatch(experience, /project-thanks-note/);
  assert.doesNotMatch(experience, /THANK YOU FOR WATCHING/);
  assert.doesNotMatch(experience, /END_PAGE/);
  assert.match(experience, /点击\$\{project\.title\}封面查看项目/);
  assert.doesNotMatch(experience, /carouselDistance/);
  assert.match(styles, /\.flat-project-grid/);
  assert.match(styles, /\.flat-project-cover img\{[^}]*object-fit:cover/);
  assert.match(styles, /white-space:nowrap/);
  assert.doesNotMatch(experience, /function FolderCoverReveal/);
  assert.doesNotMatch(experience, /folder-cover-peel-note/);
  assert.match(experience, /function FolderCoverGate/);
  assert.match(experience, /className="project-detail-toolbar"/);
  assert.match(experience, /loading=\{index === 0 \? "eager" : "lazy"\}/);
  assert.match(styles, /\.project-detail-progress/);
  assert.match(experience, /\/portfolio\/folder-covers\/visual\.jpg/);
  assert.match(experience, /window\.setTimeout\(\(\) => enterRef\.current\(\), reduced \? 220 : 1050\)/);
  assert.match(content, /"sanlin-coconut"[\s\S]*?"sanlin-soda"[\s\S]*?"fzu-letter"/);
  assert.doesNotMatch(content, /"sanlin-long"/);
  assert.match(experience, /className="photo-wall-decor"/);
  assert.match(experience, /drawerOpen\[index\] = !drawerOpen\[index\]/);
  assert.match(experience, /draggableRoots\.push\(chair\)/);
  assert.match(experience, /draggableRoots\.push\(badgeRig\)/);
  assert.match(experience, />\s*点击查看\s*<\/button>/);
  assert.match(experience, /chair\.userData\.dragMode = "rotate"/);
  assert.match(experience, /chair\.userData\.hoverKind = "chair"/);
  assert.match(experience, /chairSpinRemaining = Math\.PI \* 2/);
  assert.match(experience, /chairHovered \? 0\.92 : 0/);
  assert.match(experience, /chairUpper\.rotation\.y \+= chairStep/);
  assert.match(experience, /activeFolderFocus/);
  assert.match(experience, /activeWallFocus/);
  assert.match(experience, /hoverKind = "photoWall"/);
  assert.match(experience, /new THREE\.PerspectiveCamera\(58/);
  assert.match(experience, /点击查看个人简历/);
  assert.match(experience, /欢迎光临/);
  assert.match(experience, /邓海玲的空间/);
  assert.match(experience, /PROJECT_COVER_FOCUS/);
  assert.match(experience, /createMonitorDisplay/);
  assert.match(experience, /monitorInput\.addEventListener\("input"/);
  assert.match(experience, /monitorDisplay\.render/);
  assert.match(experience, /type SceneFocus/);
  assert.match(experience, /sceneFocus\?\.kind === "portfolio"/);
  assert.match(experience, /const portfolioBoxParts = \[/);
  assert.match(experience, /part\.userData\.portfolio = true/);
  assert.match(experience, /if \(focusRef\.current\?\.kind === "portfolio"\) folderOpenRef\.current\(id\)/);
  assert.match(experience, /hoveredFolder = focusRef\.current\?\.kind === "portfolio"/);
  assert.match(experience, /focusRef\.current\?\.kind === "photoWall"/);
  assert.match(experience, /photoProjectId/);
  assert.match(experience, /makePhotoArchiveNoteTexture/);
  assert.match(experience, /摄影图集/);
  assert.match(experience, /projectedPhoto/);
  assert.match(experience, /type PhotoFlowState = "idle" \| "entering" \| "gallery" \| "exiting"/);
  assert.match(experience, /PhotoSharedTransition/);
  assert.match(experience, /new THREE\.OrthographicCamera/);
  assert.match(experience, /corners: \[ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint\]/);
  assert.doesNotMatch(experience, /LandscapeArchiveSurface/);
  assert.match(experience, /PhotoArchiveWallOverlay/);
  assert.match(experience, /openPhotoCategoryDirect/);
  assert.match(experience, /direct-category-/);
  assert.match(experience, /点击任意一组查看完整图集/);
  assert.match(experience, /photo-archive-triptych/);
  assert.match(experience, /photo-wall-print/);
  assert.match(styles, /\.photo-wall-number\{display:none\}/);
  assert.match(styles, /\.photo-wall-label\{[^}]*top:2%[^}]*bottom:auto/);
  for (const project of ["fish", "exam", "doodle", "student"]) {
    assert.match(content, new RegExp(`"meitu-${project}": \\[\\s*\\{[^}]+meitu-${project}-02\\.webp`));
  }
  assert.match(experience, /function DraggableWallItem/);
  assert.match(experience, /setPointerCapture/);
  assert.doesNotMatch(experience, /setSelectedPhotoId/);
  assert.doesNotMatch(experience, /setSelectedId/);
  assert.match(styles, /\.dot-sticker\{background-image:none!important\}/);
  assert.match(styles, /\.experience-nav>\.tips-toggle,\.scene-guide-controls button:last-child\{font-size:12px!important\}/);
  assert.match(content, /"手作设计"/);
  assert.match(content, /handcraft-01\.webp/);
  assert.match(experience, /ocean-view\.webp/);
  assert.match(experience, /className="scene-guide-controls"/);
  assert.match(experience, /controls\.minAzimuthAngle = freeViewRef\.current \? -Infinity/);
  assert.match(experience, /const mainDeskLift = 0\.4/);
  assert.match(experience, /xinjiang-04\.webp/);
  assert.match(styles, /photo-wall-print\.print-4/);
  assert.match(experience, /scene-object-hints/);
  assert.match(experience, /点击可查看作品集/);
  assert.match(styles, /--site-font:"Hiragino Sans GB","冬青黑体简体中文"/);
  assert.match(styles, /font-family:"PortfolioHeadline"/);
  assert.doesNotMatch(experience, /frameId: `archive-overlay-\$\{item\.id\}-\$\{imageIndex\}`/);
  assert.match(experience, /onActivate=\{\(\) => onOpen\(item\.id, item\.src\)\}/);
  assert.match(experience, /const roomRug/);
  assert.doesNotMatch(experience, /ClassicPhotoSurface/);
  assert.match(experience, /function CircularPhotoGallery/);
  assert.match(experience, /new THREE\.PlaneGeometry\(1, 1, 48, 24\)/);
  assert.match(experience, /targetRef\.current \+= .* \* 0\.0028/);
  assert.match(experience, /while \(slot\.virtualIndex < base - 4\)/);
  assert.match(experience, /#include <colorspace_fragment>/);
  assert.match(experience, /uniforms\.uOpacity\.value = 1/);
  assert.match(experience, /松手自动吸附/);
  assert.match(experience, /PHOTO_REGIONS\.flatMap\(\(region\) => region\.photos\)/);
  assert.match(experience, /!sceneFocus && !active && !openingFolder && photoFlow === "idle"/);
  assert.match(styles, /\.circular-photo-gallery\{/);
  assert.match(styles, /\.circular-photo-stage canvas\{/);
  assert.match(experience, /title="风景摄影"/);
  assert.match(experience, /photoCollectionById/);
  assert.doesNotMatch(experience, /curated-photo-intro/);
  assert.doesNotMatch(experience, /travel-region-groups/);
  assert.match(experience, /shared-photo-transition/);
  assert.match(experience, /const corkBoard/);
  assert.match(experience, /const easel/);
  assert.match(experience, /const sewingTable/);
  assert.match(experience, /draggableRoots\.push\(easel\)/);
  assert.match(experience, /draggableRoots\.push\(sewingTable\)/);
  assert.match(experience, /let curtainClosed = false/);
  assert.match(experience, /userData\.curtain = true/);
  assert.match(experience, /欢迎光临/);
  assert.match(experience, /<b>邓海玲的空间<\/b>/);
  assert.match(experience, /const tableclothDrop/);
  assert.match(experience, /const sewingTools/);
  assert.match(experience, /scene-guide-notes/);
  assert.match(experience, /userData\.easelCanvas = true/);
  assert.match(experience, /const paintAt = \(event: PointerEvent\)/);
  assert.match(experience, /activeBrushColor/);
  assert.match(experience, /hovered \? 0\.32/);
  assert.match(experience, /folderOpenRef\.current\(id\)/);
  assert.match(experience, /focusChangeRef\.current\(\{ kind: "easel" \}\)/);
  assert.match(experience, /kind: "allWorks"/);
  assert.match(experience, /function AllWorksPanel/);
  assert.match(experience, /setSceneFocus\(\{ kind: "portfolio" \}\)/);
  assert.match(experience, /profile-waterfall-content/);
  assert.match(experience, /向下滑动浏览完整个人简介/);
  assert.match(experience, /profile-sheet-one/);
  assert.match(experience, /profile-sheet-two/);
  assert.match(experience, /portfolio\/resume\.jpg/);
  assert.match(experience, /const sewingPegboard/);
  assert.match(experience, /RoundedBoxGeometry\(3\.65, 6\.9/);
  assert.match(experience, /timeZone: "Asia\/Shanghai"/);
  assert.match(experience, /const calendarTimer/);
  assert.match(experience, /const bluePlush/);
  assert.match(experience, /const yellowPlush/);
  assert.match(experience, /function BulgeCoverTitle/);
  assert.match(experience, /new THREE\.PlaneGeometry\(1, 1, 180, 100\)/);
  assert.match(experience, /uniform vec2 uMouse/);
  assert.match(experience, /Math\.max\(0, 3000 -/);
  assert.match(experience, /const introCameraStart = new THREE\.Vector3\(-4\.15, 3\.25, 15\.5\)/);
  assert.match(experience, /const initialCamera = new THREE\.Vector3\(0\.35, 2\.15, 15\.8\)/);
  assert.match(experience, /\(now - introStartedAt\) \/ 2400/);
  assert.match(experience, /controls\.minAzimuthAngle = -0\.94/);
  assert.match(experience, /freeViewRef\.current \? -Infinity : -0\.94/);
  assert.match(experience, /freeViewRef\.current \? Infinity : 0\.58/);
  assert.match(styles, /font-family:"Microsoft YaHei","微软雅黑"/);
  assert.match(styles, /text-overflow:ellipsis;white-space:nowrap/);
  assert.match(experience, /new THREE\.CapsuleGeometry/);
  assert.match(experience, /const orangeFabric/);
  assert.match(experience, /const lipFabric/);
  assert.match(experience, /introReady=\{!loading\}/);
  assert.match(experience, /scene-mode-controls/);
  assert.match(experience, /freeViewRef/);
  assert.doesNotMatch(experience, /arrangeModeRef/);
  assert.match(experience, /固定视角/);
  assert.match(experience, /自由视角/);
  assert.match(experience, /kind: "portfolio"/);
  assert.match(experience, /kind: "computer"/);
  assert.match(experience, /返回全景/);
  assert.match(experience, /<button onClick=\{onBack\}>← 返回分类<\/button>/);
  assert.doesNotMatch(experience, /返回桌面空间/);
  assert.doesNotMatch(experience, /hoveredSceneKind/);
  assert.doesNotMatch(experience, /pointer\.x \* 1\.65/);
  assert.match(experience, /project-waterfall-view/);
  assert.match(experience, /const pencilRig/);
  assert.match(experience, /userData\.eraser = true/);
  assert.match(experience, /erasing \? 72 : 24/);
  assert.doesNotMatch(experience, /cameraStrap|badgeCordCurve|cordClasp/);
  assert.doesNotMatch(experience, /className="folder-hotspots"/);
  assert.doesNotMatch(experience, /cursor-magnifier|magnifier-active/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/_sites-preview/", root)));
});
