const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const baseUrl = 'https://aniworld.to';

const watchedUrl = `${baseUrl}/user/profil/vensin/watched`;

axios.get(watchedUrl, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive'
  }
})
  .then(response => {
    const $ = cheerio.load(response.data);
    
    const animes = [];
    $('.coverListItem').each((index, element) => {
      const title = $(element).find('h3').text().trim();
      const genre = $(element).find('small').text().trim();
      const imageUrl = $(element).find('.seriesListHorizontalCover img').attr('data-src');
      const link = $(element).find('a').attr('href');

      const seasonMatch = link.match(/staffel-(\d+)/);
      const episodeMatch = link.match(/episode-(\d+)/);

      const season = seasonMatch ? seasonMatch[1] : 'N/A';
      const episode = episodeMatch ? episodeMatch[1] : 'N/A';

      animes.push({
        title,
        link,
        season,  
        episode  
      });
    });

    let output = '';
    
    animes.slice(0, 5).forEach(anime => {
      output += `- **${anime.title}** - S${anime.season} E${anime.episode}\n`;
    });

    fs.readFile('README.md', 'utf8', (err, data) => {
      if (err) {
        console.error('Fehler beim Lesen der README.md:', err);
        return;
      }

      const startMarker = '<!--START_SECTION:recent_anime-->';
      const endMarker = '<!--END_SECTION:recent_anime-->';
      const startIndex = data.indexOf(startMarker);
      const endIndex = data.indexOf(endMarker);

      if (startIndex !== -1 && endIndex !== -1) {
        const beforeSection = data.substring(0, startIndex + startMarker.length);
        const afterSection = data.substring(endIndex);
        const newData = beforeSection + '\n' + output + '\n' + afterSection;

        fs.writeFile('README.md', newData, 'utf8', (err) => {
          if (err) {
            console.error('Fehler beim Schreiben in die README.md:', err);
          } else {
            console.log('README.md wurde erfolgreich aktualisiert!');
          }
        });
      } else {
        console.log('Die Tags <!--START_SECTION:recent_anime--> und <!--END_SECTION:recent_anime--> wurden nicht gefunden!');
      }
    });
  })
  .catch(error => {
    console.error('Fehler beim Abrufen der Watched-Daten:', error);
  });
