import React, { useEffect, useState, useRef } from 'react';
import { Uri, editor, KeyMod, KeyCode, languages } from 'monaco-editor';
import { initializeMode } from 'monaco-graphql/esm/initializeMode';
import { createGraphiQLFetcher } from '@graphiql/toolkit';
import * as JSONC from 'jsonc-parser';
import { debounce } from '../utils/debounce';
import validateBrackets from '../utils/validateBrackets';
import '../styles/Editor.css';
import { gql } from 'graphql-tag';
import Split from 'react-split';

/* Default Initial Display for Query Operations */
const defaultOperations =
  localStorage.getItem('operations') ??
  `
# GQL Request Pane #

query {

}
`;

/* Default Initial Display for Variables */
const defaultVariables =
  localStorage.getItem('variables') ??
  `
/* Variables Pane */

{}
`;

/* Get Model at URI, or Create One at URI with Given Value */
const getOrCreateModel = (uri, value) => {
  return (
    editor.getModel(Uri.file(uri)) ??
    editor.createModel(value, uri.split('.').pop(), Uri.file(uri))
  );
};

/* Config: Set this early on so that initial variables with comments don't flash an error */
languages.json.jsonDefaults.setDiagnosticsOptions({
  allowComments: true,
  trailingCommas: 'ignore',
});

/* Add Editor to DOM Via its Ref */
const createEditor = (ref, options) => editor.create(ref.current, options);

/** EDITOR COMPONENT **/

export default function Editor({ schema, endpoint, setQuery }) {
  /********************************************** State & Refs *************************************************/

  const opsRef = useRef(null);
  const varsRef = useRef(null);
  const resultsRef = useRef(null);
  const verticalGutterRef = useRef(null);
  const upperCopyButton = useRef(null);

  const [queryEditor, setQueryEditor] = useState(null);
  const [variablesEditor, setVariablesEditor] = useState(null);
  const [resultsViewer, setResultsViewer] = useState(null);
  const [activeLowerEditor, setActiveLowerEditor] = useState('results');

  const [MonacoGQLAPI, setMonacoGQLAPI] = useState(null);

  // Refs for accurate updates
  const currentSchema = useRef(schema);
  const fetcher = useRef(
    endpoint
      ? createGraphiQLFetcher({
          url: endpoint,
        })
      : null
  );

  /********************************************** useEFfect's *************************************************/

  /* Update Current Schema Ref for Callbacks and Listeners */
  useEffect(() => {
    currentSchema.current = schema;
    if (schema) initMonacoAPI();
  }, [schema]);

  /* Update fetcher upon endpoint change */
  useEffect(() => {
    fetcher.current = createGraphiQLFetcher({
      url: endpoint,
    });
  }, [endpoint]);

  /* Instantiate: Once on Mount */
  /* Create the Models & Editors */
  /* Assign Listeners */
  // Models represent the 'virtual files' loaded in each editor
  // Editors are the actual editor instances
  useEffect(() => {
    const queryModel = getOrCreateModel('operation.graphql', defaultOperations);
    const variablesModel = getOrCreateModel('variables.json', defaultVariables);
    const resultsModel = getOrCreateModel(
      'results.json',
      '\n/* Results Pane */ \n\n{}'
    );

    queryEditor ??
      setQueryEditor(
        createEditor(opsRef, {
          theme: 'vs-dark',
          model: queryModel,
          language: 'graphql',
          automaticLayout: true,
          minimap: {
            enabled: false
          },
          scrollbar: {
            horizontal: 'hidden',
          },
        })
      );
    variablesEditor ??
      setVariablesEditor(
        createEditor(varsRef, {
          theme: 'vs-dark',
          model: variablesModel,
          automaticLayout: true,
          minimap: {
            enabled: false
          },
          scrollbar: {
            horizontal: "hidden",
          }
        })
      );
    resultsViewer ??
      setResultsViewer(
        createEditor(resultsRef, {
          theme: 'vs-dark',
          model: resultsModel,
          readOnly: true,
          smoothScrolling: true,
          automaticLayout: true,
          minimap: {
            enabled: false
          },
          scrollbar: {
            horizontal: 'hidden',
          },
        })
      );

    // Assign Change Listeners
    // Debounce to wait 300ms after user stops typing before executing
    // Ref used here for non-stale state
    queryModel.onDidChangeContent(
      debounce(300, () => {
        if (!currentSchema.current) return;
        const markers = editor.getModelMarkers({
          resource: Uri.file('operation.graphql'),
        });
        const query = editor.getModel(Uri.file('operation.graphql')).getValue();
        // This try-catch block addresses the one crash-bug where you load a schema,
        // already have whitespace between brackets, and hit backspace
        try {
          gql`
            ${query}
          `;
        } catch (e) {
          // console.log('ERROR: ', e);
          return;
        }
        if (!markers.length) {
          if (!validateBrackets(query) || query.trim() === '') return;
          if (query.includes(`mutation`)) {
            const validOperations = getOperationsAndValidate();
            console.log(`in useEffect: `, validOperations);
            console.log(`equality check:`, validOperations === null);
            if (validOperations === null) return;

            setQuery({ queryString: validOperations });
            return;
          } else {
            setQuery({ queryString: query });
          }
          execOperation();
        }
        localStorage.setItem('operations', queryModel.getValue());
      })
    );
    variablesModel.onDidChangeContent(
      debounce(300, () => {
        localStorage.setItem('variables', variablesModel.getValue());
      })
    );

    verticalGutterRef.current = document.querySelector('.gutter-vertical');
    upperCopyButton.current = document.querySelector('.upper-copy-btn');

  }, []);

  /* Assign Keybindings */
  // Wait until editors are actually instantiated before assigning
  useEffect(() => {
    queryEditor?.addAction(queryAction);
    variablesEditor?.addAction(queryAction);
  }, [variablesEditor]);

  /* Update Schema Configuration */
  useEffect(() => {
    MonacoGQLAPI?.setSchemaConfig([{ introspectionJSON: schema }]);
  }, [schema]);

  /****************************************** Helper Functions ********************************************/

  /* Get operations pane content and checks its validation */
  const getOperationsAndValidate = () => {
    const operations = editor
      .getModel(Uri.file('operation.graphql'))
      .getValue();
    if (!validateBrackets(operations)) {
      alert('Invalid brackets'); // TODO: refactor error handling
      return null;
    }
    if (operations.trim() === '') {
      alert('Empty query'); // TODO: refactor error handling
      return null;
    }
    return operations;
  };

  /* Execute Current Operation in Query Pane (cmd + enter OR auto) */
  const execOperation = async function () {
    if (!currentSchema.current) {
      alert('Please load a valid schema'); // TODO: refactor error handling
      return;
    }
    const markers = editor.getModelMarkers({
      resource: Uri.file('operation.graphql'),
    });
    if (markers.length) {
      alert('Syntax error :)'); // TODO: refactor error handling
      return;
    }
    // Grab the code from the variables pane
    const variables = editor.getModel(Uri.file('variables.json')).getValue();
    // Grab the operations from the operations pane
    const validOperations = getOperationsAndValidate();
    if (validOperations === null) return;
    // Update query state at top level in order to update active ID's
    // Note, this went from string -> object for strict equality reasons (Always catch new instance)
    setQuery({ queryString: validOperations });
    // Create reference to the results pane
    const resultsModel = editor.getModel(Uri.file('results.json'));
    if (!fetcher.current) return;
    // Make GQL request with given operations, passing in the variables
    const result = await fetcher.current({
      query: validOperations,
      variables: JSONC.parse(variables),
    });
    // Note: this app only supports a single iteration for http GET/POST,
    // no multipart or subscriptions yet.
    const data = await result.next();

    // Display the results in results pane
    resultsModel?.setValue(
      '\n/* Results Pane */ \n\n' + JSON.stringify(data.value, null, 2)
    );
  };

  /* Keyboard Action For Executing Operation (cmd + enter) */
  const queryAction = {
    id: 'graphql-run',
    label: 'Run Operation',
    contextMenuOrder: 0,
    contextMenuGroupId: 'graphql',
    keybindings: [
      // eslint-disable-next-line no-bitwise
      KeyMod.CtrlCmd | KeyCode.Enter,
    ],
    run: execOperation,
  };

  /* Configure Monaco API & Connect to GraphQL Validation */
  const initMonacoAPI = () => {
    setMonacoGQLAPI(
      initializeMode({
        // Pair request pane with variables pane for validation
        diagnosticSettings: {
          validateVariablesJSON: {
            [Uri.file('operation.graphql').toString()]: [
              Uri.file('variables.json').toString(),
            ],
          },
          jsonDiagnosticSettings: {
            validate: true,
            schemaValidation: 'error',
            // set these again, because we are entirely re-setting them here
            allowComments: true,
            trailingCommas: 'ignore',
          },
        },
        schemas: [
          {
            introspectionJSON: currentSchema.current,
            // uri: 'myschema.graphql', // You can have multiple schemas if you want
          },
        ],
      })
    );
  };

  /* Copy the Editor Contents */
  async function copyEditorField(e, ref) {
    try {
      let uriFile;
      // set the uriFile name based on ref
      if (ref === opsRef) uriFile = 'operation.graphql';
      else if (ref === varsRef) uriFile = 'variables.json';
      else if (ref === resultsRef) uriFile = 'results.json';
      else return;
      // retrieve the contents of the uriFile
      const operations = editor.getModel(Uri.file(uriFile)).getValue().trim();
      // copy to clipboard
      await navigator.clipboard.writeText(operations);
      const copyButton = e.target;
      copyButton.innerText = 'copied!';
      setTimeout(() => copyButton.innerText = 'copy', 800);
    } catch (err) {
      copyButton.innerText = 'error!';
      setTimeout(() => copyButton.innerText = 'copy', 800);
    }
  }

  /* Hide Upper Copy Button Before Overlap Occurs */
  const handleVerticalDrag = () => {
    const viewportOffset = verticalGutterRef.current.getBoundingClientRect();
    if (viewportOffset.top < 100) upperCopyButton.current.classList.add('hidden')
    else upperCopyButton.current.classList.remove('hidden')
  }


  /************************************************ Render ******************************************************/

  return (
    <div className="monaco-container">
      <section className="editor-pane">
          <Split
            sizes={[47, 53]}
            minSize={5}
            expandToMin={false}
            gutterSize={10}
            gutterAlign="center"
            dragInterval={1}
            direction="vertical"
            cursor="row-resize"
            className="query-results-split"
            onDrag={handleVerticalDrag}
          >
          <article className="editor-container query-editor">
            <div ref={opsRef} className="editor" />
            <button className="copy-btn upper-copy-btn" onClick={(e) => copyEditorField(e, opsRef)}>
              copy
            </button>
            <button onClick={execOperation} className="submit-query-button">Submit</button>
          </article>
          <section className="lower-editor-section">
            <header className="lower-editor-tabs">
              <button className={`lower-editor-button results-button ${activeLowerEditor === 'results' ? 'active-tab' : ''}`} onClick={() => setActiveLowerEditor('results')}>
                Results
              </button>
              <button className={`lower-editor-button variables-button ${activeLowerEditor === 'variables' ? 'active-tab' : ''}`} onClick={() => setActiveLowerEditor('variables')}>
                Variables
              </button>
            </header>
            <article className={`editor-container ${activeLowerEditor === 'results' ? 'hidden' : ''}`}>
              <div ref={varsRef} className="editor vars-editor" />
              <button className="copy-btn" onClick={(e) => copyEditorField(e, varsRef)}>
                copy
              </button>
            </article>
            <article className={`editor-container ${activeLowerEditor === 'variables' ? 'hidden' : ''}`}>
              <div ref={resultsRef} className="editor" />
              <button
                className="copy-btn"
                onClick={(e) => copyEditorField(e, resultsRef)}
              >
                copy
              </button>
            </article>
          </section>
        </Split>
      </section>
    </div>
  );
}
