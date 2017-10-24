import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import TuneNTag from './tunentag.js';
import registerServiceWorker from './registerServiceWorker';

ReactDOM.render(<TuneNTag />, document.getElementById('root'));
registerServiceWorker();
