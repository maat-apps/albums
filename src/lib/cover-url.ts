// Cover sizes: the services' URLs name the size, so asking for a sharper
// cover is a matter of rewriting the URL. 1200px fills a phone's screen
// width at its pixel density; Cover Art Archive offers 250, 500 and 1200.

export const COVER_SIZE = 1200;

const COVER_ART_ARCHIVE =
  /^(https:\/\/coverartarchive\.org\/.+\/front)(-(?:250|500))?$/;
const ITUNES_ARTWORK =
  /^(https:\/\/[^/]+\.mzstatic\.com\/.+\/)(\d+)x\d+(bb)?\.(jpg|png)$/;

/**
 * The URL of the same cover at COVER_SIZE when it's a Cover Art Archive or
 * iTunes cover asked for smaller; any other URL as it is.
 */
export function largerCoverUrl(url: string): string {
  const archive = COVER_ART_ARCHIVE.exec(url);
  if (archive) return `${archive[1]}-${COVER_SIZE}`;
  const itunes = ITUNES_ARTWORK.exec(url);
  if (itunes && Number(itunes[2]) < COVER_SIZE) {
    return `${itunes[1]}${COVER_SIZE}x${COVER_SIZE}bb.${itunes[4]}`;
  }
  return url;
}
