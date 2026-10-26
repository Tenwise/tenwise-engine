import { Component } from 'react';
import { Button } from '@/components/ui/button';

/** Keeps a rendering error in one article from taking down the whole app. */
export default class ReaderErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err) { console.error('[ArticleReader]', err); }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="article-reader-panel visible" style={{ width: this.props.width }}>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="m-0 text-[13.5px] text-muted-foreground">Something went wrong displaying this article.</p>
          <Button variant="outline" size="sm" onClick={() => { this.setState({ hasError: false }); this.props.onClose(); }}>Close</Button>
        </div>
      </div>
    );
  }
}
