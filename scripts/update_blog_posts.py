"""Use Hugo's published URLs rather than reconstructing paths from slugs."""

from datetime import timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import urlopen
import xml.etree.ElementTree as ET

FEED_URL = "https://shadow3aaa.github.io/index.xml"
START = "<!-- BLOG-POST-LIST:START -->"
END = "<!-- BLOG-POST-LIST:END -->"


def blog_links(xml):
    posts = []
    for item in ET.fromstring(xml).findall("./channel/item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        url = urlsplit(link)
        if (url.scheme != "https" or url.netloc != "shadow3aaa.github.io"
                or not url.path.startswith("/blog/") or url.path == "/blog/"):
            continue
        if not title:
            raise ValueError("Blog entry has no title")
        date = parsedate_to_datetime(item.findtext("pubDate") or "")
        if date.tzinfo is None:
            date = date.replace(tzinfo=timezone.utc)
        # Escape Markdown labels without modifying the canonical URL.
        title = title.replace("\\", "\\\\").replace("[", "\\[").replace("]", "\\]")
        title = " ".join(title.splitlines())
        posts.append((date, f"- [{title}](<{link}>)"))
    if not posts:
        raise ValueError("RSS contains no blog posts; refusing to clear README")
    posts.sort(key=lambda post: post[0], reverse=True)
    return "\n".join(line for _, line in posts[:5])


def update_readme(readme, links):
    if readme.count(START) != 1 or readme.count(END) != 1:
        raise ValueError("Expected exactly one pair of blog list markers")
    start = readme.index(START) + len(START)
    end = readme.index(END)
    if end < start:
        raise ValueError("Blog list markers are reversed")
    return readme[:start] + "\n" + links + "\n" + readme[end:]


def main():
    readme = Path(__file__).resolve().parents[1] / "README.md"
    with urlopen(FEED_URL, timeout=30) as response:
        links = blog_links(response.read())
    content = update_readme(readme.read_text(encoding="utf-8"), links)
    readme.write_text(content, encoding="utf-8")
    print("Updated README with canonical blog links")


if __name__ == "__main__":
    main()
