import unittest
from update_blog_posts import blog_links, update_readme, START, END


class BlogPostsTests(unittest.TestCase):
    def test_canonical_urls_and_xml_entities(self):
        xml = '''<rss><channel>
        <item><title>Older</title><link>https://shadow3aaa.github.io/blog/Some-URL/</link>
        <pubDate>Tue, 27 Oct 2026 20:44:00 +0800</pubDate></item>
        <item><title>Claude &amp; [RSS]</title><link>https://shadow3aaa.github.io/blog/how-do-i-get-claude/</link>
        <pubDate>Wed, 28 Oct 2026 20:44:00 +0800</pubDate></item>
        <item><title>Daily</title><link>https://shadow3aaa.github.io/daily/example/</link></item>
        </channel></rss>'''
        lines = blog_links(xml).splitlines()
        self.assertEqual(len(lines), 2)
        self.assertIn(r'Claude & \[RSS\]', lines[0])
        self.assertIn('/how-do-i-get-claude/', lines[0])
        self.assertIn('/Some-URL/', lines[1])

    def test_invalid_feed_cannot_erase_posts(self):
        for xml in ('<rss><channel/></rss>', '<broken'):
            with self.assertRaises(Exception):
                blog_links(xml)

    def test_only_marked_list_changes(self):
        self.assertEqual(update_readme('before' + START + '\nold\n' + END + 'after', 'new'),
                         'before' + START + '\nnew\n' + END + 'after')
        for readme in ('missing', END + START, START + START + END):
            with self.assertRaises(ValueError):
                update_readme(readme, 'new')
