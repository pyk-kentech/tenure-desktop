// tenure fork: per-user folders kept apart from an installed upstream Orca (DESIGN.md 36.23).
// Upstream uses ~/.orca, %LOCALAPPDATA%\Orca and %APPDATA%\Orca; sharing them would mix credentials,
// hook scripts, keybindings and daemon mirrors between the two apps.
import { IS_TENURE_FORK_BUILD } from './tenure-fork-build'

export const APP_HOME_DIRNAME = IS_TENURE_FORK_BUILD ? '.tenure-desktop' : '.orca'
export const APP_DATA_DIRNAME = IS_TENURE_FORK_BUILD ? 'tenure' : 'Orca'
