# tabSidian

tabSidian is a Chrome/Edge extension that converts all your open tabs into a markdown file compatible with Obsidian (or any knowledge management system that uses markdown files).

## How do I install it?

Until I get this approved at the Microsoft Edge Add-ons store, you can download it to a local folder, tell Edge to allow unsigned extensions and load it from disk.

## How does it work?

Click on the tabSidian icon on your extension bar and it will prompt you to download a timestamped markdown file. Save it to your desired Obsidian vault folder and that's it.

## What options can I set?

Right now, you can add a list of restricted urls that the extension will ignore when generating the list of open tabs.

## What is included in the markdown file?

At this time the markdown file includes a metadata section at the top with the current date and time of creation, followed by a list of page titles and urls.

Once in Obsidian you can add comments or create new files from each url. It's up to you what you do with the information in the file.

## Limitations?

It only works on the active window. If you have several browser windows open with many tabs, you will need to run the extension once in each window. I'm not yet sure whether this is a limitation or a feature.

## How did you build this?

This was entirely built with GPT-4 and great prompt engineering. Also a lot of patience and hand-holding.

## Meta

Carlos Granier – [@cgranier](https://twitter.com/cgranier)

[https://github.com/cgranier/tabSidian](https://github.com/cgranier/tabSidian)

## Contributing

1. Fork it (<https://github.com/yourname/yourproject/fork>)
2. Create your feature branch (`git checkout -b feature/fooBar`)
3. Commit your changes (`git commit -am 'Add some fooBar'`)
4. Push to the branch (`git push origin feature/fooBar`)
5. Create a new Pull Request

