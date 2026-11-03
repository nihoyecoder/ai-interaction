import type { RestrictedReason } from '@/core/page-support';
import type { PickMode } from '@/core/selection';
import { Button } from '../components/Button';
import { ChoiceButton } from '../components/ChoiceButton';
import { ElementIcon, FullPageIcon, RecordMotionIcon, SectionIcon, SelectDesignIcon } from '../components/icons';
import { NoticeBanner } from '../components/NoticeBanner';
import { PageOutlineCard } from '../components/PageOutlineCard';
import { Screen } from '../components/Screen';
import { SelectionCard } from '../components/SelectionCard';
import type { BadgeTone } from '../components/StatusBadge';
import type { PanelView } from '../panel-view';

const RESTRICTED_COPY: Record<RestrictedReason, string> = {
  'browser-page': "Chrome doesn't let extensions work on its own pages, like the New Tab page or Settings. Open a website to continue.",
  'web-store': "Chrome doesn't let extensions work on the Chrome Web Store. Open another website to continue.",
  'local-file': "Local files aren't supported yet. Open the page through a local server, such as http://localhost, instead.",
  'not-a-website': 'AI Interaction works on regular websites, meaning pages whose address starts with http or https.',
};

const PICK_TITLES: Record<PickMode, string> = { element: 'Select an element', section: 'Select a section' };
const SELECTED_TITLES: Record<PickMode | 'page', string> = {
  element: 'Element selected',
  section: 'Section selected',
  page: 'Full page selected',
};

export interface ViewActions {
  onSelectDesign: (tabId: number, hostname: string) => void;
  onPick: (mode: PickMode) => void;
  onSelectPage: () => void;
  onCancelPicking: () => void;
  onWider: () => void;
  onNarrower: () => void;
  /** Back from a selection to the Select Design choices. */
  onClearSelection: () => void;
  /** Back to the start: disconnects, and the page is cleaned up. */
  onEndSession: () => void;
  onGoToTab: (tabId: number) => void;
}

export function ViewScreen({ view, ...actions }: { view: PanelView } & ViewActions) {
  switch (view.kind) {
    case 'loading':
      return <Screen title="Checking this page…" />;

    case 'no-access':
      return (
        <Screen title="Give access to this page" notice={view.notice && <NoticeBanner notice={view.notice} />}>
          With this page open, click the AI Interaction icon in Chrome's toolbar or in the puzzle-piece menu. Access
          lasts until you leave this site.
        </Screen>
      );

    case 'restricted':
      return <Screen title="This page can't be inspected">{RESTRICTED_COPY[view.reason]}</Screen>;

    case 'home':
      return (
        <div className="flex flex-col gap-4">
          <Screen
            eyebrow={view.hostname}
            title="What do you want to capture?"
            notice={view.notice && <NoticeBanner notice={view.notice} />}
          />
          <div className="flex flex-col gap-2">
            <ChoiceButton
              icon={<SelectDesignIcon />}
              title="Select Design"
              description="A button, a section, or the whole page."
              onClick={() => actions.onSelectDesign(view.tabId, view.hostname)}
            />
            <ChoiceButton
              icon={<RecordMotionIcon />}
              title="Record Motion"
              description="Up to 5 seconds of an animation."
              tag="Coming soon"
              disabled
            />
          </div>
          <p className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
            AI Interaction reads this page only after you choose. It stops when you go back or close this panel.
          </p>
        </div>
      );

    case 'design':
      return (
        <div className="flex flex-col gap-4">
          <Screen onBack={actions.onEndSession} eyebrow={view.hostname} title="Select Design">
            What do you want to select?
          </Screen>
          <div className="flex flex-col gap-2">
            <ChoiceButton
              icon={<ElementIcon />}
              title="Element"
              description="A button, card, image, or link."
              disabled={view.connecting}
              onClick={() => actions.onPick('element')}
            />
            <ChoiceButton
              icon={<SectionIcon />}
              title="Section"
              description="A hero, pricing table, or footer."
              disabled={view.connecting}
              onClick={() => actions.onPick('section')}
            />
            <ChoiceButton
              icon={<FullPageIcon />}
              title="Full page"
              description="The whole page, top to bottom."
              disabled={view.connecting}
              onClick={actions.onSelectPage}
            />
          </div>
        </div>
      );

    case 'picking':
      return (
        <Screen
          eyebrow={view.hostname}
          title={PICK_TITLES[view.mode]}
          actions={
            <Button variant="secondary" onClick={actions.onCancelPicking}>
              Cancel
            </Button>
          }
        >
          <p>Hover over the page, then click what you want. Clicks won't affect the page while you're selecting.</p>
          <ul className="mt-3 flex flex-col gap-1.5 text-xs">
            <KeyHint keys="↑" text="Wider: the container around it" />
            <KeyHint keys="↓" text="Narrower: back toward the pointer" />
            <KeyHint keys="Esc" text="Cancel" />
          </ul>
        </Screen>
      );

    case 'selected': {
      const { selection } = view;
      return (
        <div className="flex flex-col gap-4">
          <Screen onBack={actions.onClearSelection} eyebrow={view.hostname} title={SELECTED_TITLES[selection.scope]} />
          {selection.scope === 'page' ? (
            <PageOutlineCard selection={selection} />
          ) : (
            <>
              <SelectionCard selection={selection} onWider={actions.onWider} onNarrower={actions.onNarrower} />
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => actions.onPick(selection.scope)}>
                  Choose again
                </Button>
              </div>
            </>
          )}
        </div>
      );
    }

    case 'away':
      return (
        <Screen
          eyebrow={view.hostname}
          title="Your session is in another tab"
          actions={
            <>
              <Button onClick={() => actions.onGoToTab(view.tabId)}>Return to {view.hostname}</Button>
              <Button variant="secondary" onClick={actions.onEndSession}>
                End session
              </Button>
            </>
          }
        >
          The session stays with the tab where it started. Go back to continue, or end it to start on this tab.
        </Screen>
      );
  }
}

function KeyHint({ keys, text }: { keys: string; text: string }) {
  return (
    <li className="flex items-center gap-2">
      <kbd className="inline-flex h-5 min-w-6 items-center justify-center rounded border border-neutral-300 px-1 font-sans text-xs font-medium text-neutral-700 dark:border-neutral-700 dark:text-neutral-300">
        {keys}
      </kbd>
      {text}
    </li>
  );
}

export function getBadge(view: PanelView): { label: string; tone: BadgeTone } {
  switch (view.kind) {
    case 'loading':
      return { label: 'Checking', tone: 'neutral' };
    case 'no-access':
      return { label: 'No access', tone: 'warning' };
    case 'restricted':
      return { label: 'Unavailable', tone: 'neutral' };
    case 'home':
      return { label: 'Ready', tone: 'neutral' };
    case 'design':
      return view.connecting ? { label: 'Connecting', tone: 'neutral' } : { label: 'Connected', tone: 'positive' };
    case 'selected':
      return { label: 'Connected', tone: 'positive' };
    case 'picking':
      return { label: 'Selecting', tone: 'active' };
    case 'away':
      return { label: 'Other tab', tone: 'warning' };
  }
}
