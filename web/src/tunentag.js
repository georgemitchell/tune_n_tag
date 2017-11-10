import React, { Component } from 'react';
import logo from './static/img/logo.png';
import './style.css';
import { FormGroup, ControlLabel, FormControl, HelpBlock, InputGroup, Glyphicon } from 'react-bootstrap';
import { Col } from 'react-bootstrap';
import {AsyncTypeahead} from 'react-bootstrap-typeahead'; // ES2015


const tag_fields = [
  "youtube_id",
  "artist",
  "album",
  "song",
  "year",
  "track_number",
  "num_tracks",
  "track_id"
];

const autocomplete_url = "http://127.0.0.1:35099/";

class TuneNTag extends Component {
  constructor(props) {
    super(props);
    this.state = {
      "rows": []
    };
  }

  render() {
    return (
      <div className="container-fluid">
        <div className="row">
          <Col>
            <header className="header">
              <img src={logo} className="logo" alt="logo" />
              <h1 className="title">Find your jamz</h1>
            </header>
          </Col>
        </div>
        <div className="row">
          <Col xs={6} md={4}>
            <Console rows={this.state.rows}/>
          </Col>
          <Col xs={12} md={8}>
            <TuneForm
              onYouTubeTag={(tag) => this.handleYouTubeTag(tag)}
              onLog={(log) => this.handleLog(log)}
              onError={(error) => this.handleError(error)}
            />
          </Col>
        </div>
      </div>
    );
  };

  handleYouTubeTag(tag) {
    const rows = this.state.rows.slice();
    this.setState({
      rows: rows.concat(["Detected YouTube tag: " + tag])
    });
  };

  handleError(error) {
    const rows = this.state.rows.slice();
    this.setState({
      rows: ["[ERROR]: " + error].concat(rows)
    });
  }

  handleLog(log) {
    const rows = this.state.rows.slice();
    this.setState({
      rows: [log].concat(rows)
    }); 
  }

}

function Console(props) {
  const rows = props.rows.map((row, index) => {
    return (
      <p key={index}>
        <code>&gt; {row}</code>
      </p>
    )
  });
  return (
    <div className="console">
      {rows}
    </div>
  );
}

const YOUTUBE_RE = /https?:\/\/(?:[0-9A-Z-]+\.)?(?:youtu\.be\/|youtube(?:-nocookie)?\.com\S*?[^\w\s-])([\w-]{11})(?=[^\w-]|$)(?![?=&+%\w.-]*(?:['"][^<>]*>|<\/a>))[?=&+%\w.-]*/ig; 

function ping_job_status(tune_form, job_id, on_success, on_failure) {
  fetch(`${autocomplete_url}job/?i=${job_id}`)
    .then(resp => resp.json())
    .then(json => {
      if(json.success) {
        var job = json.job;
        if(job.success) {
          on_success(job);
        } else {
          if (!("success" in job)) {
            tune_form.props.onLog(`${job.name} Progress: ${job.progress}%`);
            setTimeout(function() { 
              ping_job_status(tune_form, job_id, on_success, on_failure) 
            }, 10000);
          } else {
            on_failure(job.error);
          }
        }
      } else {
        on_failure(json.error);
      }
    });
}

function SubmitButton(props) {
  return (
    <button type="button" disabled={(props.track == null) || (props.video_id == null)} className="btn" onClick={props.onClick}>
      Tune-n-tag
    </button>
  );
}

function buildUrl(base, state, extra_fields=[]) {
  var fields = [];
  for (var i=0; i<tag_fields.length; i++) {
    fields.push(tag_fields[i] + "=" + encodeURIComponent(state[tag_fields[i]]));
  }

  fields = fields.concat(extra_fields);

  return base + "?" + fields.join("&");
}

class TuneForm extends Component {
  constructor(props) {
    super(props);
    this.state = {
      youtube_url: "",
      artist: null,
      album: null,
      song: null,
      video_id: null
    }
  };

  handleYouTubeChange(e) {
    this.setState(
      { youtube_url: e.target.value, video_id: YOUTUBE_RE.exec(e.target.value)[1] },
      function() {
        this.props.onYouTubeTag(this.state.video_id);
      }
    );
  };

  queryArtist() {
    //if(this.state)
  };

  handleSelectArtist(selected) {
    if(selected.length === 0) {
      this.props.onError("Artist selected, but no artist found");
    } else {
      var artist = selected[0];
      if(artist.id === null) {
        this.props.onLog("Querying musicbrainz for '" + artist.name + "'");
        fetch(`${autocomplete_url}artist/?q=${artist.name}`)
          .then(resp => resp.json())
          .then(json => {
            if(json.artists.length === 1) {
              this.setState(
                  {artist: json.artists[0]},
                  function() { 
                    this.props.onLog("Using artist: '" + json.artists[0].name + "'"); 
                  }
                );
            } else {
              for(var i=0; i<json.artists.length; i++) {
                this.props.onLog("Found artist: '" + json.artists[i].name + "'");
              }  
            }
          }
        );
      } else {
        this.setState(
          {artist: artist},
          function() { 
            this.props.onLog("Using artist: '" + artist.name + "'"); 
          }
        );
      } 
    }
  }

  handleSelectAlbum(selected) {
    if(selected.length === 0) {
      this.props.onError("Album selected, but no album found");
    } else {
      var album = selected[0];
      if(album.customOption) {
        if(this.state.artist !== null) {
          this.props.onLog("Querying musicbrainz for " + this.state.artist.name + "'s albums");
          var log_function = this.props.onLog;
          var error_function = this.props.onError;
          fetch(`${autocomplete_url}albums/?a=${this.state.artist.id}`)
            .then(resp => resp.json())
            .then(json => {
              ping_job_status(
                this,
                json.job_id,
                function(job) {
                  log_function(`${job.name} Finished: ${job.album_count} albums, ${job.track_count} tracks`);
                },
                function(error) {
                  error_function(error);
                }
              );
            }
          );
        } else {
          this.props.onError("Tried to run musicbrainz query without artist specified");
        }
      } else {
        this.setState(
          {album: album},
          function() { 
            this.props.onLog("Using album: '" + album.title + "'"); 
          }
        );
      } 
    }
  }

  handleSelectSong(selected) {
    if(selected.length === 0) {
      this.props.onError("Song selected, but no song found");
    } else {
      var song = selected[0];
      if(song.customOption) {
        this.props.onLog("Querying musicbrainz for " + song.title);
        var log_function = this.props.onLog;
        var error_function = this.props.onError;
        fetch(`${autocomplete_url}track/?q=${song.title}`)
          .then(resp => resp.json())
          .then(json => {
            if(json.success) {
              if(json.tracks.length > 0) {
                json.tracks.forEach(function(track) {
                  var albums = [];
                  track.albums.forEach(function(album) {
                    albums.push(album.title);
                  });
                  log_function(`Found ${track.title} (${track.artist}) [${albums.join(",")}]`);
                });
              } else {
                log_function("No songs found");
              }
            } else {
              error_function(json.error);
            }
          }
        );
      } else {
        this.setState(
          {song: song},
          function() { 
            this.props.onLog("Using song: '" + song.title + "'");
            console.log(song);
          }
        );  
      }
    }
  }


  handleDownloadRequest() {
    this.props.onLog("Downloading and tagging " + this.state.video_id);
    var log_function = this.props.onLog;
    var error_function = this.props.onError;
    var current_state = {
      "youtube_id": this.state.video_id,
      "artist": this.state.song.artist,
      "album": this.state.song.album,
      "song": this.state.song.title,
      "year": this.state.song.year,
      "track_number": this.state.song.track_number,
      "num_tracks": this.state.song.num_tracks,
      "track_id": this.state.song.id
    };
    var url = buildUrl(`${autocomplete_url}tunentag/`, current_state);

    fetch(url)
      .then(resp => resp.json())
      .then(json => {
        if(json.success) {
          ping_job_status(
            this,
            json.job_id,
            function(job) {
              log_function(`${job.name} Finished!`);
              job.status.forEach(function(entry) {
                log_function(` ${entry}`);
              });
              var extra_fields=[
                'filters=track_id',
                'src=' + job.mp3_src
              ]
              var tag_url = buildUrl(`${autocomplete_url}update_tag/`, current_state, extra_fields);
              console.log(tag_url);
              fetch(tag_url)
                .then(tag_resp => tag_resp.json())
                .then(tag_json => {
                  if(tag_json.success) {
                    log_function(`${current_state.song} successfully tagged`);
                  } else {
                    error_function(tag_json.error);
                  }
                  
                });
            },
            function(error) {
              error_function(error);
            }
          );
        } else {
          error_function(json.error);
        }
      });
  }

  render() {
    return (
      <form>
        <YouTubeField onChange={(e) => this.handleYouTubeChange(e)} value={this.state.youtube_url} />
        <ArtistField onSelectArtist={(selected) => this.handleSelectArtist(selected)} value={this.state.artist} />
        <AlbumField onSelectAlbum={(selected) => this.handleSelectAlbum(selected)} value={this.state.album} artist={this.state.artist} />
        <SongField onSelectSong={(selected) => this.handleSelectSong(selected)} value={this.state.song} artist={this.state.artist} album={this.state.album} />
        <SubmitButton track={this.state.song} video_id={this.state.video_id} onClick={() => this.handleDownloadRequest()} />
      </form>
    );
  };
}

class YouTubeField extends Component {
  constructor(props) {
    super(props);
    this.state = {
      value: "",
    }
  };

  getValidationState() {
    if(this.state.value.match(YOUTUBE_RE) != null) {
      return "success"
    } else {
      if(this.state.value !== "") {
        return "error"
      } else {
        return "warning"
      }
    }
  };

  render() {
    return (
      <FormGroup
          controlId="youtube_url"
          validationState={this.getValidationState()}
      >
        <ControlLabel>YouTube URL</ControlLabel>
        <FormControl
          type="text"
          value={this.props.value}
          placeholder="https://www.youtube.com/watch?v=Z6VrKro8djw"
          onChange={this.props.onChange}
        />
        <FormControl.Feedback />
        <HelpBlock>You must specify a valid YouTube URL</HelpBlock>
      </FormGroup>
    )
  };
}

function make_country_image(country) {
  var image;
  if(country === undefined) {
    image = "xx.png";
  } else if(country === "musicbrainz") {
    image = "musicbrainz.png";
  } else {
    image = country.toLowerCase() + ".png";
  }
  return process.env.PUBLIC_URL + "/img/flags-mini/" + image;
}

class ArtistField extends Component {

  constructor(props) {
    super(props);

    this.state = {
      value: "",
      allowNew: false,
      multiple: false,
      options: [],
    };
  }

  render() {
    return (
      <FormGroup
          controlId="artist"
      >
        <ControlLabel>Artist / Band</ControlLabel>
        <InputGroup>
          <AsyncTypeahead
            {...this.state}
            labelKey="name"
            value={this.props.value}
            onSearch={this._handleSearch}
            placeholder="The Rolling Stones"
            renderMenuItemChildren={this._renderMenuItemChildren}
            onChange={this.props.onSelectArtist}
          />
          <InputGroup.Addon>
            <Glyphicon glyph="music" />
          </InputGroup.Addon>
        </InputGroup>
        <FormControl.Feedback />
        <HelpBlock>Specify the artist / band's name</HelpBlock>
      </FormGroup>
    );
  }

  _renderMenuItemChildren(option, props, index) {
    return (
      <div key={option.id}>
        <img
          src={make_country_image(option.country)}
          alt={option.country}
          style={{
            height: '20px',
            marginRight: '10px',
            width: '40px',
          }}
        />
        <span>{option.name} ({option.life_span})</span>
      </div>
    );
  }

  _handleSearch = query => {
    if (!query) {
      return;
    }

    fetch(`${autocomplete_url}autocomplete/artist/?q=${query}`)
      .then(resp => resp.json())
      .then(json => {
        var options = json.artists;
        var musicbrainz = {
          id: null,
          name: query,
          country: "musicbrainz",
          life_span: "??"
        }
        options.push(musicbrainz);
        this.setState({options: options})
      }
    );
  }
}


class AlbumField extends Component {

  constructor(props) {
    super(props);

    this.state = {
      value: "",
      allowNew: true,
      multiple: false,
      options: [],
    };
  }

  render() {
    return (
      <FormGroup
          controlId="album"
      >
        <ControlLabel>Album</ControlLabel>
        <InputGroup>
          <AsyncTypeahead
            {...this.state}
            labelKey="title"
            value={this.props.value}
            onSearch={this._handleSearch}
            placeholder="Sticky Fingers"
            renderMenuItemChildren={this._renderMenuItemChildren}
            onChange={this.props.onSelectAlbum}
          />
          <InputGroup.Addon>
            <Glyphicon glyph="music" />
          </InputGroup.Addon>
        </InputGroup>
        <FormControl.Feedback />
        <HelpBlock>Specify the album</HelpBlock>
      </FormGroup>
    );
  }

  _renderMenuItemChildren(option, props, index) {
    return (
      <div key={option.id}>
        <span>{option.title} ({option.date} {option.format} {option.country})</span>
      </div>
    );
  }

  _handleSearch = query => {
    if (!query) {
      return;
    }
    var url = `${autocomplete_url}autocomplete/album/?q=${query}` 
    if(this.props.artist != null) {
      url += `&a=${this.props.artist.id}`;
    }
    fetch(url)
      .then(resp => resp.json())
      .then(json => {
        if(json.success) {
          this.setState({options: json.albums});
        } else {
          this.onError(json.error);
        }
      }
    );
  }
}


class SongField extends Component {

  constructor(props) {
    super(props);

    this.state = {
      value: "",
      allowNew: true,
      multiple: false,
      options: [],
    };
  }

  render() {
    return (
      <FormGroup
          controlId="song"
      >
        <ControlLabel>Song</ControlLabel>
        <InputGroup>
          <AsyncTypeahead
            {...this.state}
            labelKey="title"
            value={this.props.value}
            onSearch={this._handleSearch}
            placeholder="I Can't Get No (Satisfaction)"
            renderMenuItemChildren={this._renderMenuItemChildren}
            onChange={this.props.onSelectSong}
          />
          <InputGroup.Addon>
            <Glyphicon glyph="music" />
          </InputGroup.Addon>
        </InputGroup>
        <FormControl.Feedback />
        <HelpBlock>Specify the song</HelpBlock>
      </FormGroup>
    );
  }

  _renderMenuItemChildren(option, props, index) {
    /*var entry = option.title;
    if(props.artist === null) {
      entry += ` - ${option.artist}`;
    }

    if(props.album === null) {
      entry += ` [${option.album}] `;
    }
    */

    return (
      <div key={option.id}>
        <span>{option.title} - {option.artist} [{option.album}] ({option.date} {option.format} {option.country})</span>
      </div>
    );
  }

  _handleSearch = query => {
    if (!query) {
      return;
    }

    var url = `${autocomplete_url}autocomplete/track/?q=${query}` 
    if(this.props.artist !== null) {
      url += `&a=${this.props.artist.id}`;
    }

    if(this.props.album !== null) {
      url += `&r=${this.props.album.id}`;
    }

    fetch(url)
      .then(resp => resp.json())
      .then(json => {
        this.setState({options: json.tracks})
      }
    );
  }
}

export default TuneNTag;
