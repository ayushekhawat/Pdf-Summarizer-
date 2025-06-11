import React, { useState, useEffect } from 'react';

// Removed dynamic script creation, assuming these are in public/index.html
// as recommended for cleaner App.js and proper loading.

function App() {
  const [pdfFile, setPdfFile] = useState(null);
  const [extractedText, setExtractedText] = useState('');
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Removed API key state management as it will be handled by the environment
  // Removed showApiKeyInput state as it's no longer needed


  /**
   * Handles the file upload event.
   * Reads the PDF file and extracts text using pdf.js.
   * @param {Event} event - The file input change event.
   */
  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      setExtractedText('');
      setSummary('');
      setError('');
      setLoading(true);

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          // Ensure pdfjsLib is loaded before proceeding
          if (typeof window.pdfjsLib === 'undefined') {
            setError('PDF.js library not loaded. Please ensure it is linked correctly in index.html and try again.');
            setLoading(false);
            return;
          }

          // Set the worker source for pdf.js
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

          const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(e.target.result) }).promise;
          let fullText = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            // Join items with a space for readability, and ensure new lines are handled if present in content
            fullText += textContent.items.map(item => item.str).join(' ') + '\n';
          }
          setExtractedText(fullText);
          setLoading(false);
        } catch (err) {
          console.error('Error extracting text from PDF:', err);
          setError('Failed to extract text from PDF. Please ensure it\'s a valid PDF and not password protected.');
          setLoading(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setPdfFile(null);
      setExtractedText('');
      setSummary('');
      setError('Please upload a valid PDF file.');
    }
  };

  /**
   * Summarizes the extracted text using the Gemini API.
   * Calls the LLM with a summarization prompt.
   */
  const summarizeText = async () => {
    if (!extractedText) {
      setError('No text extracted to summarize. Please upload a PDF first.');
      return;
    }

    // A basic check for text length, very long text might cause issues
    // The actual token limit for Gemini models can vary, 50000 characters is a rough estimate.
    if (extractedText.length > 50000) {
        setError('The extracted text is very long (over 50,000 characters). Please try a smaller PDF or a more concise document, or consider using a different summarization approach for very large texts.');
        return;
    }

    setLoading(true);
    setSummary('');
    setError('');

    try {
      let chatHistory = [];
      const prompt = `Summarize the following text:\n\n${extractedText}`;
      chatHistory.push({ role: "user", parts: [{ text: prompt }] });

      const payload = { contents: chatHistory };
      // API Key will now be handled by the environment, set to an empty string.
      const apiKey = "";
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      console.log('Gemini API raw response:', result); // Log the full response for debugging

      if (response.ok && result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        const text = result.candidates[0].content.parts[0].text;
        setSummary(text);
      } else {
        // Handle common API error structures
        if (result.error && result.error.message) {
            setError(`API Error: ${result.error.message}`);
        } else if (result.promptFeedback && result.promptFeedback.blockReason) {
            setError(`Summary blocked due to: ${result.promptFeedback.blockReason}. Content might violate safety policies.`);
        } else if (result.candidates && result.candidates.length === 0) {
            setError('The AI did not provide any summary candidates. The content might be too sensitive or inappropriate for the model.');
        }
        else {
            setError('Failed to get a summary from the AI. The response structure was unexpected.');
        }
        console.error('Unexpected API response structure or no candidates:', result);
      }
    } catch (err) {
      console.error('Error calling Gemini API:', err);
      setError('An error occurred while summarizing the text. Please check your internet connection or try again later. (Network Error/CORS issue)');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-4 font-sans antialiased">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-2xl transform transition-all duration-300 hover:scale-105">
        <h1 className="text-4xl font-extrabold text-center text-gray-800 mb-8 tracking-tight">
          <span className="text-blue-600">PDF</span> Summarizer Agent
        </h1>

        <div className="mb-6">
          <label htmlFor="pdf-upload" className="block text-lg font-medium text-gray-700 mb-3 cursor-pointer">
            <div className="flex items-center justify-center p-6 border-2 border-dashed border-blue-300 rounded-xl bg-blue-50 hover:bg-blue-100 transition duration-200 ease-in-out">
              <svg className="w-10 h-10 text-blue-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
              </svg>
              <span className="text-blue-700 text-xl font-semibold">
                {pdfFile ? `Selected: ${pdfFile.name}` : 'Upload a PDF Document'}
              </span>
            </div>
            <input
              id="pdf-upload"
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </div>

        {/* Removed API Key Input Section */}
        {/* The section for API key input and its associated logic has been removed. */}

        {loading && (
          <div className="flex items-center justify-center mb-6 text-blue-600">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
            <span>{extractedText ? 'Summarizing...' : 'Extracting text...'}</span>
          </div>
        )}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl relative mb-6" role="alert">
            <strong className="font-bold">Error!</strong>
            <span className="block sm:inline ml-2">{error}</span>
          </div>
        )}

        {extractedText && (
          <div className="mb-6 flex justify-center">
            <button
              onClick={summarizeText}
              disabled={loading} /* Removed dependency on apiKey, now only disabled if loading */
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition duration-300 ease-in-out transform hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Summarizing...' : 'Summarize PDF'}
            </button>
          </div>
        )}

        {summary && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold text-gray-700 mb-4 border-b-2 border-blue-200 pb-2">Summary:</h2>
            <div className="bg-blue-50 p-5 rounded-xl border border-blue-200 text-gray-800 leading-relaxed shadow-inner">
              <p className="whitespace-pre-wrap">{summary}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
