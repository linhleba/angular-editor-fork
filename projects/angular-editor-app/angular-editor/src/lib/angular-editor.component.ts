import { DOCUMENT } from '@angular/common';
import {
  AfterViewInit,
  Attribute,
  ChangeDetectorRef,
  Component, ContentChild,
  ElementRef,
  EventEmitter,
  forwardRef,
  HostBinding,
  HostListener,
  Inject,
  Input,
  OnDestroy,
  OnInit,
  Output,
  Renderer2,
  SecurityContext, TemplateRef,
  ViewChild
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer } from '@angular/platform-browser';
import { AngularEditorToolbarComponent } from './angular-editor-toolbar.component';
import { AngularEditorService } from './angular-editor.service';
import { AngularEditorConfig, angularEditorConfig } from './config';
import { isDefined } from './utils';




@Component({
  selector: 'angular-editor',
  templateUrl: './angular-editor.component.html',
  styleUrls: ['./angular-editor.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AngularEditorComponent),
      multi: true
    },
    AngularEditorService
  ]
})
export class AngularEditorComponent implements OnInit, ControlValueAccessor, AfterViewInit, OnDestroy {
  @ViewChild('editor', { static: false }) editor!: ElementRef;
  editorContent: string = '';  
  isPreviewMode = false;
  originalRawContent = ''; 
  private onChange: (value: string) => void;
  private onTouched: () => void;

  modeVisual = true;
  showPlaceholder = false;
  disabled = false;
  focused = false;
  touched = false;
  changed = false;

  focusInstance: any;
  blurInstance: any;

  @Input() id = '';
  @Input() config: AngularEditorConfig = angularEditorConfig;
  @Output() validationError = new EventEmitter<string>();
  warningMessage: string | null = null;
  @Input() placeholder = '';
  @Input() tabIndex: number | null;

  @Output() html;

  @ViewChild('editor', {static: true}) textArea: ElementRef;
  @ViewChild('editorWrapper', {static: true}) editorWrapper: ElementRef;
  @ViewChild('editorToolbar') editorToolbar: AngularEditorToolbarComponent;
  @ContentChild("customButtons") customButtonsTemplateRef?: TemplateRef<any>;
  executeCommandFn = this.executeCommand.bind(this);

  @Output() viewMode = new EventEmitter<boolean>();

  /** emits `blur` event when focused out from the textarea */
    // eslint-disable-next-line @angular-eslint/no-output-native, @angular-eslint/no-output-rename
  @Output('blur') blurEvent: EventEmitter<FocusEvent> = new EventEmitter<FocusEvent>();

  /** emits `focus` event when focused in to the textarea */
    // eslint-disable-next-line @angular-eslint/no-output-rename, @angular-eslint/no-output-native
  @Output('focus') focusEvent: EventEmitter<FocusEvent> = new EventEmitter<FocusEvent>();

  @HostBinding('attr.tabindex') tabindex = -1;

  @HostListener('focus')
  onFocus() {
    this.focus();
  }

  constructor(
    private r: Renderer2,
    private editorService: AngularEditorService,
    @Inject(DOCUMENT) private doc: any,
    private sanitizer: DomSanitizer,
    private cdRef: ChangeDetectorRef,
    @Attribute('tabindex') defaultTabIndex: string,
    private http: HttpClient,
    @Attribute('autofocus') private autoFocus: any
  ) {
    const parsedTabIndex = Number(defaultTabIndex);
    this.tabIndex = (parsedTabIndex || parsedTabIndex === 0) ? parsedTabIndex : null;
  }

  ngOnInit() {
    console.log('config', this.config.previewMode);
    this.config.toolbarPosition = this.config.toolbarPosition ? this.config.toolbarPosition : angularEditorConfig.toolbarPosition;
  }

  ngAfterViewInit() {
    if (isDefined(this.autoFocus)) {
      this.focus();
    }
  }

  insertMarkdown(markdown: string) {
    // const textarea = this.editorTextarea.nativeElement;
    // const cursorPos = textarea.selectionStart;
    // const text = textarea.value;
    // textarea.value = text.slice(0, cursorPos) + markdown + text.slice(cursorPos);
  }

  uploadImage(file: File): void {
    // const reader = new FileReader();
    // reader.onload = (e: ProgressEvent<FileReader>) => {
    //   const imageUrl = e.target?.result as string;
  
    //   // Insert the image URL into the editor content
    //   document.execCommand('insertImage', false, imageUrl);
    // };

    // console.log('file is', file);
    // console.log(`FILE image size is ${file.size / 1024 / 1024} MB, ${file.size / 1024} KB`)
    // reader.readAsDataURL(file);
    const formData = new FormData();
    formData.append('file', file);

    this.http.post<{ filename: string }>('your-api/upload', formData)
    .subscribe((res) => {
      const markdown = `![${res.filename}](attachment:${res.filename})`;
      // this.insertMarkdown(markdown);
    });
  }

  compressImage(file: File, quality: number, callback: (blob: Blob) => void): void {
    const img = new Image();
    const reader = new FileReader();
  
    reader.onload = (e) => {
      img.src = e.target?.result as string;
  
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
        let { width, height } = img;
  
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
  
        canvas.toBlob(
          (blob) => {
            if (blob) {
              callback(blob);
            }
          },
          'image/jpeg',
          quality
        );
      };
    };
  
    reader.readAsDataURL(file);
  }

  onPaste(event: ClipboardEvent){
    // this.pasteError = null;

    if (!event.clipboardData) {
      return;
    }

    // Get the clipboard items

    if (this.config.maxPasteImageSize) {
      const items = Array.from(event.clipboardData.items);
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();

          if (file && file.size > this.config.maxPasteImageSize) {
            event.preventDefault();
            console.log(`before compress ${file.size / 1024 / 1024} MB, ${file.size / 1024} KB`)
            this.warningMessage = 
              `Image is too large! Maximum allowed size is ${this.config.maxPasteImageSize / 1024 / 1024} MB.`;
            this.validationError.emit(this.warningMessage); 
            this.compressImage(file, 0.7, (compressedBlob) => {
              const compressedFile = new File([compressedBlob], file.name, {
                type: compressedBlob.type,
              });
              console.log('Compressed File Size:', compressedFile.size / 1024, 'KB');
              this.uploadImage(compressedFile);
            });
            console.log('image uplodated');
            return;
          }
          console.log(`image size is ${file.size / 1024 / 1024} MB, ${file.size / 1024} KB`)
        }
      }
    }

    if (this.config.rawPaste) {
      event.preventDefault();
      const text = event.clipboardData.getData('text/plain');
      document.execCommand('insertHTML', false, text);
      return text;
    }
  }

  /**
   * Executed command from editor header buttons
   * @param command string from triggerCommand
   * @param value
   */
  executeCommand(command: string, value?: string) {
    this.focus();
    console.log('command is', command);
    if (command === 'preview') {
      this.isPreviewMode = !this.isPreviewMode;
      let editorEl = this.editor.nativeElement;
      if (!this.isPreviewMode) {
          // Lưu lại nội dung gốc
          this.originalRawContent = editorEl.innerHTML;
        const rawHtml = editorEl.innerHTML;
        // URL giả cho ảnh S3, có thể thay đổi thành URL thực tế của bạn
        const s3BaseUrl = 'https://letsenhance.io/static/73136da51c245e80edc6ccfe44888a99/1015f'; 

        // Thay thế 'attachment:' bằng URL thật
        const updatedHtml = rawHtml.replace(
          /!\([^)]+\)\(attachment:([^)]+)\)/g,
          (match, filename) => {
            const realUrl = `<img src="${s3BaseUrl}/${filename}" />`;
            return realUrl;
          }
        );

        console.log('updateHtml', updatedHtml);
        editorEl.innerHTML = updatedHtml;
        editorEl.setAttribute('contenteditable', 'false');
      }
      else {
        const currentHtml = editorEl.innerHTML;
        const reverted = currentHtml.replace(
          /<img[^>]+src="[^"]+\/([^"/]+)"[^>]*>/g,
          (match, filename) => `!(${filename})(attachment:${filename})`
        );
        
        editorEl.innerHTML = reverted;
        editorEl.setAttribute('contenteditable', 'true');
      }
    }
    if (command === 'focus') {
      return;
    }
    if (command === 'toggleEditorMode') {
      this.toggleEditorMode(this.modeVisual);
    } else if (command !== '') {
      if (command === 'clear') {
        this.editorService.removeSelectedElements(this.getCustomTags());
        this.onContentChange(this.textArea.nativeElement);
      } else if (command === 'default') {
        this.editorService.removeSelectedElements('h1,h2,h3,h4,h5,h6,p,pre');
        this.onContentChange(this.textArea.nativeElement);
      } else {
        this.editorService.executeCommand(command, value);
      }
      this.exec();
    }
  }

  /**
   * focus event
   */
  onTextAreaFocus(event: FocusEvent): void {
    if (this.focused) {
      event.stopPropagation();
      return;
    }
    this.focused = true;
    this.focusEvent.emit(event);
    if (!this.touched || !this.changed) {
      this.editorService.executeInNextQueueIteration(() => {
        this.configure();
        this.touched = true;
      });
    }
  }

  /**
   * @description fires when cursor leaves textarea
   */
  public onTextAreaMouseOut(event: MouseEvent): void {
    this.editorService.saveSelection();
  }

  /**
   * blur event
   */
  onTextAreaBlur(event: FocusEvent) {
    /**
     * save selection if focussed out
     */
    this.editorService.executeInNextQueueIteration(this.editorService.saveSelection);

    if (typeof this.onTouched === 'function') {
      this.onTouched();
    }

    if (event.relatedTarget !== null) {
      const parent = (event.relatedTarget as HTMLElement).parentElement;
      if (!parent.classList.contains('angular-editor-toolbar-set') && !parent.classList.contains('ae-picker')) {
        this.blurEvent.emit(event);
        this.focused = false;
      }
    }
  }

  /**
   *  focus the text area when the editor is focused
   */
  focus() {
    if (this.modeVisual) {
      this.textArea.nativeElement.focus();
    } else {
      const sourceText = this.doc.getElementById('sourceText' + this.id);
      sourceText.focus();
      this.focused = true;
    }
  }

  /**
   * Executed from the contenteditable section while the input property changes
   * @param element html element from contenteditable
   */
  onContentChange(element: HTMLElement): void {
    let html = '';
    if (this.modeVisual) {
      html = element.innerHTML;
    } else {
      html = element.innerText;
    }
    if ((!html || html === '<br>')) {
      html = '';
    }
    if (typeof this.onChange === 'function') {
      this.onChange(this.config.sanitize || this.config.sanitize === undefined ?
        this.sanitizer.sanitize(SecurityContext.HTML, html) : html);
      if ((!html) !== this.showPlaceholder) {
        this.togglePlaceholder(this.showPlaceholder);
      }
    }
    this.changed = true;
  }

  /**
   * Set the function to be called
   * when the control receives a change event.
   *
   * @param fn a function
   */
  registerOnChange(fn: any): void {
    this.onChange = e => (e === '<br>' ? fn('') : fn(e)) ;
  }

  /**
   * Set the function to be called
   * when the control receives a touch event.
   *
   * @param fn a function
   */
  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  /**
   * Write a new value to the element.
   *
   * @param value value to be executed when there is a change in contenteditable
   */
  writeValue(value: any): void {

    if ((!value || value === '<br>' || value === '') !== this.showPlaceholder) {
      this.togglePlaceholder(this.showPlaceholder);
    }

    if (value === undefined || value === '' || value === '<br>') {
      value = null;
    }

    this.refreshView(value);
  }

  /**
   * refresh view/HTML of the editor
   *
   * @param value html string from the editor
   */
  refreshView(value: string): void {
    const normalizedValue = value === null ? '' : value;
    this.r.setProperty(this.textArea.nativeElement, 'innerHTML', normalizedValue);

    return;
  }

  /**
   * toggles placeholder based on input string
   *
   * @param value A HTML string from the editor
   */
  togglePlaceholder(value: boolean): void {
    if (!value) {
      this.r.addClass(this.editorWrapper.nativeElement, 'show-placeholder');
      this.showPlaceholder = true;

    } else {
      this.r.removeClass(this.editorWrapper.nativeElement, 'show-placeholder');
      this.showPlaceholder = false;
    }
  }

  /**
   * Implements disabled state for this element
   *
   * @param isDisabled Disabled flag
   */
  setDisabledState(isDisabled: boolean): void {
    const div = this.textArea.nativeElement;
    const action = isDisabled ? 'addClass' : 'removeClass';
    this.r[action](div, 'disabled');
    this.disabled = isDisabled;
  }

  /**
   * toggles editor mode based on bToSource bool
   *
   * @param bToSource A boolean value from the editor
   */
  toggleEditorMode(bToSource: boolean) {
    let oContent: any;
    const editableElement = this.textArea.nativeElement;

    if (bToSource) {
      oContent = this.r.createText(editableElement.innerHTML);
      this.r.setProperty(editableElement, 'innerHTML', '');
      this.r.setProperty(editableElement, 'contentEditable', false);

      const oPre = this.r.createElement('pre');
      this.r.setStyle(oPre, 'margin', '0');
      this.r.setStyle(oPre, 'outline', 'none');

      const oCode = this.r.createElement('code');
      this.r.setProperty(oCode, 'id', 'sourceText' + this.id);
      this.r.setStyle(oCode, 'display', 'block');
      this.r.setStyle(oCode, 'white-space', 'pre-wrap');
      this.r.setStyle(oCode, 'word-break', 'keep-all');
      this.r.setStyle(oCode, 'outline', 'none');
      this.r.setStyle(oCode, 'margin', '0');
      this.r.setStyle(oCode, 'background-color', '#fff5b9');
      this.r.setProperty(oCode, 'contentEditable', true);
      this.r.appendChild(oCode, oContent);
      this.focusInstance = this.r.listen(oCode, 'focus', (event) => this.onTextAreaFocus(event));
      this.blurInstance = this.r.listen(oCode, 'blur', (event) => this.onTextAreaBlur(event));
      this.r.appendChild(oPre, oCode);
      this.r.appendChild(editableElement, oPre);

      // ToDo move to service
      this.doc.execCommand('defaultParagraphSeparator', false, 'div');

      this.modeVisual = false;
      this.viewMode.emit(false);
      oCode.focus();
    } else {
      if (this.doc.querySelectorAll) {
        this.r.setProperty(editableElement, 'innerHTML', editableElement.innerText);
      } else {
        oContent = this.doc.createRange();
        oContent.selectNodeContents(editableElement.firstChild);
        this.r.setProperty(editableElement, 'innerHTML', oContent.toString());
      }
      this.r.setProperty(editableElement, 'contentEditable', true);
      this.modeVisual = true;
      this.viewMode.emit(true);
      this.onContentChange(editableElement);
      editableElement.focus();
    }
    this.editorToolbar.setEditorMode(!this.modeVisual);
  }

  /**
   * toggles editor buttons when cursor moved or positioning
   *
   * Send a node array from the contentEditable of the editor
   */
  exec() {
    this.editorToolbar.triggerButtons();

    let userSelection;
    if (this.doc.getSelection) {
      userSelection = this.doc.getSelection();
      this.editorService.executeInNextQueueIteration(this.editorService.saveSelection);
    }

    let a = userSelection.focusNode;
    const els = [];
    while (a && a.id !== 'editor') {
      els.unshift(a);
      a = a.parentNode;
    }
    this.editorToolbar.triggerBlocks(els);
  }

  private configure() {
    this.editorService.uploadUrl = this.config.uploadUrl;
    this.editorService.uploadWithCredentials = this.config.uploadWithCredentials;
    if (this.config.defaultParagraphSeparator) {
      this.editorService.setDefaultParagraphSeparator(this.config.defaultParagraphSeparator);
    }
    if (this.config.defaultFontName) {
      this.editorService.setFontName(this.config.defaultFontName);
    }
    if (this.config.defaultFontSize) {
      this.editorService.setFontSize(this.config.defaultFontSize);
    }
  }

  getFonts() {
    const fonts = this.config.fonts ? this.config.fonts : angularEditorConfig.fonts;
    return fonts.map(x => {
      return {label: x.name, value: x.name};
    });
  }

  getCustomTags() {
    const tags = ['span'];
    this.config.customClasses.forEach(x => {
      if (x.tag !== undefined) {
        if (!tags.includes(x.tag)) {
          tags.push(x.tag);
        }
      }
    });
    return tags.join(',');
  }

  ngOnDestroy() {
    if (this.blurInstance) {
      this.blurInstance();
    }
    if (this.focusInstance) {
      this.focusInstance();
    }
  }

  filterStyles(html: string): string {
    html = html.replace('position: fixed;', '');
    return html;
  }
}
