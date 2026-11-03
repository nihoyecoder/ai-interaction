import { describe, expect, it } from 'vitest';
import {
  elementLevels,
  findSection,
  isSectioning,
  pageOutline,
  type Box,
  type PageNode,
  type PageTree,
  type Placement,
  type SectionResult,
} from './sections';

// Page sketches: el('section.hero', [left, top, width, height], options?, ...children), in page coordinates.
interface Sketch {
  tag: string;
  name: string;
  box: Box;
  placement: Placement;
  role: string | null;
  display: string;
  clips: boolean;
  topLayer: boolean;
  kids: Sketch[];
}
type Options = Partial<Pick<Sketch, 'placement' | 'role' | 'display' | 'clips' | 'topLayer'>>;

function el(name: string, [left, top, width, height]: number[], ...rest: Array<Options | Sketch>): Sketch {
  const options = rest[0] && !('kids' in rest[0]) ? (rest.shift() as Options) : {};
  return {
    tag: name.split(/[.#]/)[0]!,
    name,
    box: { left: left!, top: top!, width: width!, height: height! },
    placement: 'flow',
    role: null,
    display: 'block',
    clips: false,
    topLayer: false,
    ...options,
    kids: rest as Sketch[],
  };
}
const sticky: Options = { placement: 'sticky' };
const fixed: Options = { placement: 'fixed' };
const absolute: Options = { placement: 'absolute' };
const inline: Options = { display: 'inline' };

function toNode(sketch: Sketch): PageNode {
  return {
    tag: sketch.tag,
    role: sketch.role,
    box: sketch.box,
    display: sketch.display,
    placement: sketch.placement,
    clipsX: sketch.clips,
    clipsY: sketch.clips,
    topLayer: sketch.topLayer,
    children: sketch.kids
      .filter((kid) => kid.box.width > 0 && kid.box.height > 0)
      .map((kid) => ({ box: kid.box, placement: kid.placement, sectioning: isSectioning(kid.tag, kid.role) })),
  };
}

function pathTo(sketch: Sketch, name: string): Sketch[] | null {
  if (sketch.name === name) return [sketch];
  for (const kid of sketch.kids) {
    const path = pathTo(kid, name);
    if (path) return [sketch, ...path];
  }
  return null;
}

type Mode = 'section' | 'element';

/** Runs the rules with the pointer on `hovered`, and names the result: the chosen element and the levels, initial in brackets. */
function pick(
  html: Sketch,
  hovered: string,
  viewport: number[],
  pageHeight: number,
  { mode = 'section', pointer }: { mode?: Mode; pointer?: { x: number; y: number } } = {},
) {
  const path = pathTo(html, hovered);
  if (!path) throw new Error(`No ${hovered} in the sketch`);
  const sketches = path.reverse();
  const box = sketches[0]!.box;
  const [left, top, width, height] = viewport as [number, number, number, number];
  const input = {
    chain: sketches.map(toNode),
    viewport: { left, top, width, height },
    pageHeight,
    pointer: pointer ?? { x: box.left + box.width / 2, y: box.top + box.height / 2 },
  };
  const result: SectionResult = mode === 'section' ? findSection(input) : elementLevels(input);
  if (result.kind === 'between') return { between: sketches[0]!.kids[result.child]!.name };
  if (result.kind === 'none') return { none: true };
  const levels = result.levels.map((level, index) => {
    const others = level.members.filter((member) => member !== level.element).map((member) => sketches[member]!.name);
    const label = sketches[level.element]!.name + (others.length > 0 ? ` (+${others.join(', ')})` : '');
    return index === result.initial ? `[${label}]` : label;
  });
  return { section: sketches[result.levels[result.initial]!.element]!.name, levels };
}

/** Runs Full page's outline and names the sections it lists. */
function outline(html: Sketch, viewport: number[], pageHeight: number): string[] {
  const names = new Map<PageNode, string>();
  const toTree = (sketch: Sketch): PageTree => {
    const node = toNode(sketch);
    names.set(node, sketch.name);
    let subtrees: PageTree[] | null = null;
    return {
      node,
      subtrees: () => (subtrees ??= sketch.kids.filter((kid) => kid.box.width > 0 && kid.box.height > 0).map(toTree)),
    };
  };
  const body = html.kids.find((kid) => kid.tag === 'body');
  if (!body) throw new Error('No body in the sketch');
  const [left, top, width, height] = viewport as [number, number, number, number];
  return pageOutline(toTree(body), { viewport: { left, top, width, height }, pageHeight }).map((tree) => names.get(tree.node)!);
}

// Desktop viewport 1440 × 900 unless noted.

const tailwindLanding = () =>
  el('html', [0, 0, 1440, 6900], el('body', [0, 0, 1440, 6900], el('div#root', [0, 0, 1440, 6900],
    el('div.bg-white', [0, 0, 1440, 6900],
      el('header', [0, 0, 1440, 80], absolute),
      el('main', [0, 0, 1440, 6500],
        el('div.hero', [0, 0, 1440, 1300]),
        el('div.features', [0, 1300, 1440, 1200],
          el('div.banner', [0, 1300, 1440, 240]),
          el('div.container', [80, 1636, 1280, 768],
            el('div.intro', [384, 1636, 672, 120]),
            el('div.grid', [112, 1820, 1216, 584],
              el('div.card', [112, 1820, 389, 340], el('p', [136, 2000, 341, 72])),
              el('div.card-2', [525, 1820, 389, 340]),
              el('div.card-3', [939, 1820, 389, 340])))),
        el('div.testimonials', [0, 2560, 1440, 900]), // revealing: still shifted 60 px down over div.pricing
        el('div.pricing', [0, 3400, 1440, 1400]),
        el('div.faq', [80, 4928, 1280, 800]),
        el('div.cta', [0, 5856, 1440, 644])),
      el('footer', [80, 6500, 1280, 400])))));

const oneScreen = () =>
  el('html', [0, 0, 1440, 900], el('body', [0, 0, 1440, 900], el('div#root', [0, 0, 1440, 900],
    el('div.app', [0, 0, 1440, 900],
      el('header', [0, 0, 1440, 80], absolute, el('nav', [80, 16, 1280, 48], el('a', [1200, 28, 80, 24], inline))),
      el('div.hero', [0, 0, 1440, 900],
        el('div.container', [80, 200, 1280, 500], el('h1', [80, 200, 900, 144]), el('p', [80, 368, 700, 84])))))));

const docsLayout = () =>
  el('html', [0, 0, 1440, 4400], el('body', [0, 0, 1440, 4400],
    el('header', [0, 1000, 1440, 64], sticky),
    el('div.layout', [0, 64, 1440, 4036],
      el('aside', [0, 1064, 280, 836], sticky),
      el('main', [280, 64, 1160, 4036],
        el('div.breadcrumbs', [312, 112, 1096, 24]),
        el('article', [312, 160, 1096, 3700], el('h2', [312, 1100, 1096, 40]), el('p', [312, 1160, 720, 96])),
        el('div.pager', [312, 3988, 1096, 64]))),
    el('footer', [0, 4100, 1440, 300])));

describe('findSection', () => {
  it('picks the full-bleed band, not its centered container (Tailwind landing page)', () => {
    expect(pick(tailwindLanding(), 'p', [0, 1500, 1440, 900], 6900)).toEqual({
      section: 'div.features',
      levels: ['p', 'div.card', 'div.grid', 'div.container', '[div.features]', 'main'],
    });
  });

  it('tells content from sections by the 16 px gutter alone at 390 px wide', () => {
    const page = el('html', [0, 0, 390, 14000], el('body', [0, 0, 390, 14000], el('div#root', [0, 0, 390, 14000],
      el('div.bg-white', [0, 0, 390, 14000],
        el('header', [0, 0, 390, 64], absolute),
        el('main', [0, 0, 390, 13500],
          el('div.hero', [0, 0, 390, 1900]),
          el('div.features', [0, 1900, 390, 2400],
            el('div.container', [0, 1900, 390, 2400],
              el('div.intro', [16, 1900, 358, 400]),
              el('div.grid', [16, 2300, 358, 2000],
                el('div.card', [16, 2300, 358, 560], el('p', [40, 2600, 310, 96])),
                el('div.card-2', [16, 2892, 358, 560]),
                el('div.card-3', [16, 3484, 358, 560])))),
          el('div.testimonials', [0, 4300, 390, 2000]),
          el('div.pricing', [0, 6300, 390, 3000]),
          el('div.cta', [0, 9300, 390, 4200])),
        el('footer', [0, 13500, 390, 500])))));
    expect(pick(page, 'p', [0, 2000, 390, 844], 14000)).toEqual({
      section: 'div.features',
      levels: ['p', 'div.card', 'div.grid', '[div.features (+div.container)]'],
    });
  });

  it('keeps a padded section whole when its rows span the container (Bootstrap at 390 px)', () => {
    const page = el('html', [0, 0, 390, 5000], el('body', [0, 0, 390, 5000],
      el('header', [0, 0, 390, 56]),
      el('main', [0, 56, 390, 4544],
        el('section.hero', [0, 56, 390, 700]),
        el('section.features', [0, 756, 390, 1400],
          el('div.container', [0, 804, 390, 1304],
            el('div.row', [0, 804, 390, 120], el('div.col-12', [0, 804, 390, 120])),
            el('div.row-2', [0, 948, 390, 1160],
              el('div.col', [0, 948, 390, 560], el('div.card', [12, 948, 366, 560], el('p', [28, 1200, 334, 80]))),
              el('div.col-b', [0, 1532, 390, 560])))),
        el('section.pricing', [0, 2156, 390, 1400]),
        el('section.cta', [0, 3556, 390, 1044])),
      el('footer', [0, 4600, 390, 400])));
    expect(pick(page, 'p', [0, 600, 390, 844], 5000)).toEqual({
      section: 'section.features',
      levels: ['p', 'div.card', 'div.col', 'div.row-2', 'div.container', '[section.features]', 'main'],
    });
  });

  it('merges wrappers with the same box, and names the level after the <section> (Webflow)', () => {
    const page = el('html', [0, 0, 1440, 5200], el('body', [0, 0, 1440, 5200],
      el('div.page-wrapper', [0, 0, 1440, 5200],
        el('nav.navbar', [0, 0, 1440, 80]),
        el('main.main-wrapper', [0, 80, 1440, 4720],
          el('section.section_hero', [0, 80, 1440, 900],
            el('div.padding-global', [0, 80, 1440, 900],
              el('div.container-large', [80, 80, 1280, 900],
                el('div.padding-section-large', [80, 80, 1280, 900],
                  el('div.hero-content', [80, 192, 1280, 400], el('h1', [80, 192, 800, 160])),
                  el('div.logos', [80, 640, 1280, 228]))))),
          el('section.section_features', [0, 980, 1440, 1600]),
          el('section.section_cta', [0, 2580, 1440, 2220])),
        el('footer.footer', [0, 4800, 1440, 400]))));
    expect(pick(page, 'h1', [0, 0, 1440, 900], 5200)).toEqual({
      section: 'section.section_hero',
      levels: [
        'h1',
        'div.hero-content',
        'div.container-large (+div.padding-section-large)',
        '[section.section_hero (+div.padding-global)]',
        'main.main-wrapper',
      ],
    });
  });

  it('starts at a fixed header inside the hero, and at a dropdown hanging below it', () => {
    const page = el('html', [0, 0, 1440, 6000], el('body', [0, 0, 1440, 6000], el('div#__next', [0, 0, 1440, 6000],
      el('main', [0, 0, 1440, 5600],
        el('section.hero', [0, 0, 1440, 900],
          el('header', [0, 1200, 1440, 112], fixed,
            el('div.announce', [0, 1200, 1440, 40]),
            el('div.nav-row', [0, 1240, 1440, 72],
              el('nav', [400, 1256, 640, 40], el('a', [420, 1264, 80, 24], inline)),
              el('div.dropdown', [400, 1312, 640, 360], absolute, el('a.menu-link', [432, 1344, 200, 32], inline)))),
          el('div.hero-content', [80, 200, 1280, 500])),
        el('section.features', [0, 900, 1440, 2000]),
        el('section.more', [0, 2900, 1440, 2700])),
      el('footer', [0, 5600, 1440, 400]))));
    // A <header> is one section even with two full-width rows; nothing above it is a level.
    expect(pick(page, 'a', [0, 1200, 1440, 900], 6000)).toEqual({
      section: 'header',
      levels: ['a', 'nav', 'div.nav-row', '[header]'],
    });
    // The dropdown hangs below the header's box, so the header can't contain the pointer.
    expect(pick(page, 'a.menu-link', [0, 1200, 1440, 900], 6000)).toEqual({
      section: 'div.dropdown',
      levels: ['a.menu-link', '[div.dropdown]', 'div.nav-row', 'header'],
    });
  });

  it("isn't thrown off by a stuck sticky header overlapping <main>", () => {
    const page = el('html', [0, 0, 1440, 6000], el('body', [0, 0, 1440, 6000],
      el('div.page', [0, 0, 1440, 6000],
        el('header', [0, 2000, 1440, 64], sticky, el('div.bar', [40, 2012, 1360, 40], el('img.logo', [40, 2016, 120, 32]))),
        el('main', [0, 64, 1440, 5536],
          el('section.a', [0, 64, 1440, 1800]),
          el('section.b', [0, 1864, 1440, 1800], el('div.container', [80, 1960, 1280, 1608], el('p', [80, 2400, 800, 96]))),
          el('section.c', [0, 3664, 1440, 1936])),
        el('footer', [80, 5600, 1280, 400]))));
    expect(pick(page, 'p', [0, 2000, 1440, 900], 6000)).toEqual({
      section: 'section.b',
      levels: ['p', 'div.container', '[section.b]', 'main'],
    });
  });

  it('handles a page one screen tall, with a header floating over the hero', () => {
    // The hero box is the section (merged with the same-box app wrappers), not its container.
    expect(pick(oneScreen(), 'h1', [0, 0, 1440, 900], 900)).toEqual({
      section: 'div#root',
      levels: ['h1', 'div.container', '[div#root (+div.hero, div.app)]'],
    });
    // The floating header is its own section, although the hero fills the page underneath it.
    expect(pick(oneScreen(), 'a', [0, 0, 1440, 900], 900)).toEqual({
      section: 'header',
      levels: ['a', 'nav', '[header]'],
    });
  });

  it("doesn't split a post into sections at its full-width images (WordPress block theme)", () => {
    const paragraph = (name: string, top: number, height: number) => el(name, [395, top, 650, height]);
    const page = el('html', [0, 0, 1440, 4200], el('body', [0, 0, 1440, 4200],
      el('div.wp-site-blocks', [0, 0, 1440, 4200],
        el('header.wp-block-template-part', [0, 0, 1440, 96]),
        el('main.wp-block-group', [0, 96, 1440, 3804],
          el('h1.wp-block-post-title', [395, 96, 650, 120]),
          el('div.entry-content', [0, 240, 1440, 3636],
            paragraph('p.intro', 240, 96),
            el('figure.alignfull', [0, 360, 1440, 560]),
            paragraph('p.body', 944, 120), paragraph('h2', 1088, 48), paragraph('p.b', 1160, 144),
            el('figure.alignfull-2', [0, 1328, 1440, 560]),
            paragraph('p.c', 1912, 400), paragraph('p.d', 2336, 400), paragraph('p.e', 2760, 400),
            paragraph('p.f', 3184, 400), paragraph('p.g', 3608, 268))),
        el('footer.wp-block-template-part', [0, 3900, 1440, 300]))));
    expect(pick(page, 'p.body', [0, 600, 1440, 900], 4200)).toEqual({
      section: 'main.wp-block-group',
      levels: ['p.body', 'div.entry-content', '[main.wp-block-group]'],
    });
  });

  it('treats a docs layout with a sticky sidebar as columns, with the content column as the section', () => {
    expect(pick(docsLayout(), 'p', [0, 1000, 1440, 900], 4400)).toEqual({
      section: 'main',
      levels: ['p', 'article', '[main]', 'div.layout'],
    });
  });

  it('snaps to the nearest section when the pointer is in the gap between two', () => {
    const page = el('html', [0, 0, 1440, 5000], el('body', [0, 0, 1440, 5000],
      el('main', [0, 0, 1440, 5000],
        el('section.a', [0, 0, 1440, 1200]),
        el('section.b', [0, 1328, 1440, 1200]),
        el('section.c', [0, 2656, 1440, 1200]),
        el('section.d', [0, 3984, 1440, 1016]))));
    expect(pick(page, 'main', [0, 1000, 1440, 900], 5000, { pointer: { x: 700, y: 1300 } })).toEqual({
      between: 'section.b',
    });
  });

  it('merges a carousel track, slide, and viewport into one level, as clipped by the viewport', () => {
    const page = el('html', [0, 0, 1440, 7000], el('body', [0, 0, 1440, 7000],
      el('main', [0, 0, 1440, 7000],
        el('section.hero', [0, 0, 1440, 1800]),
        el('section.slider', [0, 1800, 1440, 1000],
          el('div.container', [80, 1864, 1280, 872],
            el('h2', [80, 1864, 1280, 48]),
            el('div.swiper', [80, 1952, 1280, 720], { clips: true },
              el('div.swiper-wrapper', [-1200, 1952, 3840, 720],
                el('div.slide-1', [-1200, 1952, 1280, 720]),
                el('div.slide-2', [80, 1952, 1280, 720], el('iframe', [120, 1992, 1200, 640])),
                el('div.slide-3', [1360, 1952, 1280, 720]))))),
        el('section.next', [0, 2800, 1440, 4200]))));
    expect(pick(page, 'iframe', [0, 2000, 1440, 900], 7000)).toEqual({
      section: 'section.slider',
      levels: ['iframe', 'div.swiper (+div.slide-2, div.swiper-wrapper)', 'div.container', '[section.slider]'],
    });
  });

  it('picks the centered panel of a full-screen modal <dialog> in the top layer', () => {
    const page = el('html', [0, 0, 1440, 8000], el('body', [0, 0, 1440, 8000],
      el('main', [0, 0, 1440, 8000],
        el('section.a', [0, 0, 1440, 3000]),
        el('section.pricing', [0, 3000, 1440, 5000],
          el('div.plans', [80, 3100, 1280, 800]),
          el('dialog', [0, 3000, 1440, 900], { placement: 'fixed', topLayer: true },
            el('div.center', [0, 3000, 1440, 900],
              el('div.panel', [440, 3250, 560, 400],
                el('div.panel-body', [464, 3274, 512, 280]),
                el('div.actions', [464, 3578, 512, 48], el('button', [856, 3578, 120, 48])))))))));
    expect(pick(page, 'button', [0, 3000, 1440, 900], 8000)).toEqual({
      section: 'div.panel',
      levels: ['button', 'div.actions', '[div.panel]'],
    });
  });

  it('keeps a two-column hero whole on a short page, and a 40 px bar as its own section', () => {
    const page = el('html', [0, 0, 1440, 1500], el('body', [0, 0, 1440, 1500],
      el('div.page', [0, 0, 1440, 1500],
        el('div.announce', [0, 0, 1440, 40], el('p', [520, 10, 400, 20])),
        el('header', [0, 40, 1440, 72]),
        el('div.hero', [0, 112, 1440, 1000],
          el('div.text', [0, 112, 720, 1000], el('h1', [96, 400, 560, 144])),
          el('div.media', [720, 112, 720, 1000], el('img', [720, 112, 880, 1000]))),
        el('footer', [0, 1112, 1440, 388]))));
    expect(pick(page, 'h1', [0, 0, 1440, 900], 1500)).toEqual({
      section: 'div.hero',
      levels: ['h1', 'div.text', '[div.hero]'],
    });
    expect(pick(page, 'p', [0, 0, 1440, 900], 1500)).toEqual({
      section: 'div.announce',
      levels: ['p', '[div.announce]'],
    });
  });

  it('handles centered sections on a long page, a card in a shadow root, and an inline <svg> icon', () => {
    const page = el('html', [0, 0, 1440, 6000], el('body', [0, 0, 1440, 6000],
      el('header', [0, 0, 1440, 80]),
      el('main', [0, 80, 1440, 5520],
        el('section.intro', [208, 176, 1024, 800]),
        el('div.cards', [208, 1072, 1024, 1400],
          el('h2', [208, 1072, 1024, 48]),
          el('div.grid', [208, 1184, 1024, 1288],
            el('x-card', [208, 1184, 496, 600], el('div.card', [208, 1184, 496, 600], el('svg', [240, 1216, 32, 32]))),
            el('x-card.b', [736, 1184, 496, 600]))),
        el('section.quotes', [208, 2568, 1024, 1200]),
        el('section.faq', [208, 3864, 1024, 1640])),
      el('footer', [0, 5600, 1440, 400])));
    expect(pick(page, 'svg', [0, 1500, 1440, 900], 6000)).toEqual({
      section: 'div.cards',
      levels: ['svg', 'x-card (+div.card)', 'div.grid', '[div.cards]', 'main'],
    });
  });

  it('finds sections inside a fixed smooth-scrolling wrapper (GSAP ScrollSmoother)', () => {
    const page = el('html', [0, 0, 1440, 6000], el('body', [0, 0, 1440, 6000],
      el('div#smooth-wrapper', [0, 2000, 1440, 900], { placement: 'fixed', clips: true },
        el('div#smooth-content', [0, 0, 1440, 6000],
          el('section.a', [0, 0, 1440, 2000]),
          el('section.b', [0, 2000, 1440, 2000], el('p', [80, 2400, 800, 96])),
          el('section.c', [0, 4000, 1440, 2000])))));
    expect(pick(page, 'p', [0, 2000, 1440, 900], 6000)).toEqual({
      section: 'section.b',
      levels: ['p', '[section.b (+div#smooth-content, div#smooth-wrapper)]'],
    });
  });

  it("picks a modal's panel when the dialog is a fixed layer instead of the top layer (Headless UI)", () => {
    const page = el('html', [0, 0, 1440, 5000], el('body', [0, 0, 1440, 5000],
      el('main', [0, 0, 1440, 5000], el('section.a', [0, 0, 1440, 2500]), el('section.b', [0, 2500, 1440, 2500])),
      el('div.fixed.inset-0', [0, 1000, 1440, 900], fixed,
        el('div.flex.min-h-full', [0, 1000, 1440, 900],
          el('div.panel', [464, 1250, 512, 400], el('button', [800, 1580, 140, 44]))))));
    expect(pick(page, 'button', [0, 1000, 1440, 900], 5000)).toEqual({
      section: 'div.panel',
      levels: ['button', '[div.panel]'],
    });
  });

  it('keeps a pinned scroll-telling section whole, sticky stage included', () => {
    const page = el('html', [0, 0, 1440, 6000], el('body', [0, 0, 1440, 6000],
      el('main', [0, 0, 1440, 6000],
        el('section.hero', [0, 0, 1440, 900]),
        el('section.scrolly', [0, 900, 1440, 2700], el('div.stage', [0, 1500, 1440, 900], sticky, el('h2', [200, 1800, 800, 96]))),
        el('section.after', [0, 3600, 1440, 2400]))));
    expect(pick(page, 'h2', [0, 1500, 1440, 900], 6000)).toEqual({
      section: 'section.scrolly',
      levels: ['h2', 'div.stage', '[section.scrolly]'],
    });
  });

  it('handles bento pages, whose sections are cards inset by the page padding', () => {
    const page = el('html', [0, 0, 1440, 4000], el('body', [0, 0, 1440, 4000],
      el('main.p-4', [0, 0, 1440, 4000],
        el('section.one', [16, 16, 1408, 1000]),
        el('section.two', [16, 1032, 1408, 1400], el('p', [64, 1200, 600, 96])),
        el('section.three', [16, 2448, 1408, 1536]))));
    expect(pick(page, 'p', [0, 1000, 1440, 900], 4000)).toEqual({
      section: 'section.two',
      levels: ['p', '[section.two]'],
    });
  });
});

describe('elementLevels', () => {
  it('starts at the hovered element, with the same levels to widen through', () => {
    expect(pick(tailwindLanding(), 'p', [0, 1500, 1440, 900], 6900, { mode: 'element' })).toEqual({
      section: 'p',
      levels: ['[p]', 'div.card', 'div.grid', 'div.container', 'div.features', 'main'],
    });
  });

  it('keeps an inline element when it is the one hovered', () => {
    expect(pick(oneScreen(), 'a', [0, 0, 1440, 900], 900, { mode: 'element' })).toEqual({
      section: 'a',
      levels: ['[a]', 'nav', 'header'],
    });
  });

  it('offers the page itself when the pointer is on <body>', () => {
    expect(pick(oneScreen(), 'body', [0, 0, 1440, 900], 900, { mode: 'element' })).toEqual({
      section: 'body',
      levels: ['[body]'],
    });
  });
});

describe('pageOutline', () => {
  it('opens framework wrappers and <main> to list the page sections in order', () => {
    expect(outline(tailwindLanding(), [0, 0, 1440, 900], 6900)).toEqual([
      'header',
      'div.hero',
      'div.features',
      'div.testimonials',
      'div.pricing',
      'div.faq',
      'div.cta',
      'footer',
    ]);
  });

  it('lists the columns of a docs layout, sticky sidebar included', () => {
    expect(outline(docsLayout(), [0, 1000, 1440, 900], 4400)).toEqual(['header', 'aside', 'main', 'footer']);
  });

  it('lists a header floating over the hero of a one-screen page', () => {
    expect(outline(oneScreen(), [0, 0, 1440, 900], 900)).toEqual(['header', 'div.hero']);
  });

  it('leaves out decoration and small floating buttons, and keeps fixed bars', () => {
    const page = el('html', [0, 0, 1440, 3000], el('body', [0, 0, 1440, 3000],
      el('div.glow', [0, 0, 1440, 3000], absolute),
      el('header', [0, 0, 1440, 72], fixed),
      el('section.hero', [0, 0, 1440, 900]),
      el('section.features', [0, 900, 1440, 1700]),
      el('footer', [0, 2600, 1440, 400]),
      el('button.chat', [1360, 820, 56, 56], fixed),
      el('div.cookie-banner', [0, 780, 1440, 120], fixed)));
    expect(outline(page, [0, 0, 1440, 900], 3000)).toEqual([
      'header',
      'section.hero',
      'section.features',
      'footer',
      'div.cookie-banner',
    ]);
  });
});
