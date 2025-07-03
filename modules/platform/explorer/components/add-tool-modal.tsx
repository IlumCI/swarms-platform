import LoadingSpinner from '@/shared/components/loading-spinner';
import Modal from '@/shared/components/modal';
import { Button } from '@/shared/components/ui/button';
import Input from '@/shared/components/ui/Input/Input';
import { useToast } from '@/shared/components/ui/Toasts/use-toast';
import { debounce } from '@/shared/utils/helpers';
import { trpc } from '@/shared/utils/trpc/trpc';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { explorerCategories, languageOptions } from '@/shared/utils/constants';
import MultiSelect from '@/shared/components/ui/multi-select';
import { useMemo, useRef, useState } from 'react';
import { useAuthContext } from '@/shared/components/ui/auth.provider';
import { useModelFileUpload } from '../hook/upload-file';
import ModelFileUpload from './upload-image';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAddSuccessfully: () => void;
  modelType: string;
}

const AddToolModal = ({
  isOpen,
  onClose,
  onAddSuccessfully,
  modelType,
}: Props) => {
  const { user } = useAuthContext();
  const [toolName, setToolName] = useState('');
  const [description, setDescription] = useState('');
  const [tool, setTool] = useState('');
  const [tags, setTags] = useState('');
  const [language, setLanguage] = useState('python');
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const {
    image,
    imageUrl,
    filePath,
    uploadProgress,
    uploadStatus,
    isDeleteFile,
    uploadImage,
    deleteImage,
  } = useModelFileUpload();

  const imageUploadRef = useRef<HTMLInputElement>(null);

  const validateTool = trpc.explorer.validateTool.useMutation();

  const debouncedCheckPrompt = useMemo(() => {
    const debouncedFn = debounce((value: string) => {
      validateTool.mutateAsync(value);
    }, 400);
    return debouncedFn;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCategoriesChange = (selectedCategories: string[]) => {
    setCategories(selectedCategories);
  };

  const toast = useToast();

  const addTool = trpc.explorer.addTool.useMutation();

  const handleImageUploadClick = () => {
    imageUploadRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (uploadStatus === 'uploading') return;

    const file = e.target.files?.[0];
    if (!file) return;

    if (filePath && modelType) {
      await deleteImage(filePath, modelType);
    }

    await uploadImage(file, modelType);
  };

  const handleDrop = async (e: React.DragEvent) => {
    if (uploadStatus === 'uploading') return;

    e.preventDefault();

    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (filePath && modelType) {
      await deleteImage(filePath, modelType);
    }

    await uploadImage(file, modelType);
  };

  const submit = () => {
    // Validate Tool
    if (validateTool.isPending) {
      toast.toast({
        title: 'Validating Tool',
      });
      return;
    }

    // Form validation
    if (!toolName || toolName.trim().length === 0) {
      toast.toast({
        title: 'Form Validation Error',
        description: 'Tool name is required',
        variant: 'destructive',
      });
      return;
    }

    if (toolName.trim().length < 2) {
      toast.toast({
        title: 'Form Validation Error',
        description: 'Tool name must be at least 2 characters long',
        variant: 'destructive',
      });
      return;
    }

    if (toolName.length > 100) {
      toast.toast({
        title: 'Form Validation Error',
        description: 'Tool name cannot exceed 100 characters',
        variant: 'destructive',
      });
      return;
    }

    if (!description || description.trim().length === 0) {
      toast.toast({
        title: 'Form Validation Error',
        description: 'Description is required',
        variant: 'destructive',
      });
      return;
    }

    if (description.trim().length < 10) {
      toast.toast({
        title: 'Form Validation Error',
        description: 'Description must be at least 10 characters long',
        variant: 'destructive',
      });
      return;
    }

    if (description.length > 1000) {
      toast.toast({
        title: 'Form Validation Error',
        description: 'Description cannot exceed 1,000 characters',
        variant: 'destructive',
      });
      return;
    }

    if (!tool || tool.trim().length === 0) {
      toast.toast({
        title: 'Form Validation Error',
        description: 'Tool code is required',
        variant: 'destructive',
      });
      return;
    }

    if (tool.trim().length < 5) {
      toast.toast({
        title: 'Form Validation Error',
        description: 'Tool code must be at least 5 characters long',
        variant: 'destructive',
      });
      return;
    }

    if (tool.length > 50000) {
      toast.toast({
        title: 'Form Validation Error',
        description: 'Tool code cannot exceed 50,000 characters',
        variant: 'destructive',
      });
      return;
    }

    if (validateTool.data && !validateTool.data.valid) {
      toast.toast({
        title: 'Invalid Tool',
        description: validateTool.data.error,
        variant: 'destructive',
      });
      return;
    }

    if (categories.length === 0) {
      toast.toast({
        title: 'Form Validation Error',
        description: 'Please select at least one category',
        variant: 'destructive',
      });
      return;
    }

    // Validate tags if provided
    if (tags && tags.trim().length > 0) {
      const tagList = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      if (tagList.length > 10) {
        toast.toast({
          title: 'Form Validation Error',
          description: 'Maximum 10 tags allowed',
          variant: 'destructive',
        });
        return;
      }

      if (tagList.some((tag) => tag.length > 50)) {
        toast.toast({
          title: 'Form Validation Error',
          description: 'Each tag must be 50 characters or less',
          variant: 'destructive',
        });
        return;
      }
    }

    const trimTags = tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
      .join(',');

    setIsLoading(true);

    // Add Tool
    addTool
      .mutateAsync({
        name: toolName,
        tool,
        description,
        useCases: [{ title: '', description: '' }],
        language,
        category: categories,
        imageUrl: imageUrl || undefined,
        filePath: imageUrl && filePath ? filePath : undefined,
        requirements: [{ package: '', installation: '' }],
        tags: trimTags,
      })
      .then(async () => {
        toast.toast({
          title: 'Tool added successfully 🎉',
        });

        onClose();
        onAddSuccessfully();
        // Reset form
        setToolName('');
        setTool('');
        setDescription('');
        setTags('');
      })
      .catch((error) => {
        console.log({ error });
        toast.toast({
          title: 'An error has occurred',
        });
        setIsLoading(false);
      });
  };

  if (!user) return null;

  return (
    <Modal
      className="max-w-2xl overflow-y-auto"
      isOpen={isOpen}
      onClose={onClose}
      title="Add Tool"
    >
      <div className="flex flex-col gap-2 overflow-y-auto h-[60vh] relative px-4">
        <div className="flex flex-col gap-1">
          <span>Name</span>
          <div className="relative">
            <Input
              value={toolName}
              onChange={setToolName}
              placeholder="Enter name"
              className="border border-gray-300 dark:border-gray-600 focus:border-yellow-500 dark:focus:border-yellow-400"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span>Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter description"
            className="w-full h-20 p-2 border border-gray-300 dark:border-gray-600 focus:border-yellow-500 dark:focus:border-yellow-400 rounded-md bg-transparent outline-0 resize-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span>Tool Code - (Add types and docstrings)</span>
          <div className="relative">
            <textarea
              value={tool}
              onChange={(v) => {
                setTool(v.target.value);
                debouncedCheckPrompt(v.target.value);
              }}
              required
              placeholder="Enter tool code here..."
              className="w-full h-20 p-2 border border-gray-300 dark:border-gray-600 focus:border-yellow-500 dark:focus:border-yellow-400 rounded-md bg-transparent outline-0 resize-none"
            />
            {validateTool.isPending ? (
              <div className="absolute right-2 top-2">
                <LoadingSpinner />
              </div>
            ) : (
              <div className="absolute right-2.5 top-2.5">
                {tool.length > 0 && validateTool.data && (
                  <span
                    className={
                      validateTool.data.valid
                        ? 'text-green-500'
                        : 'text-red-500'
                    }
                  >
                    {validateTool.data.valid ? '✅' : ''}
                  </span>
                )}
              </div>
            )}
          </div>
          {tool.length > 0 &&
            !validateTool.isPending &&
            validateTool.data &&
            !validateTool.data.valid && (
              <span className="text-red-500 text-sm">
                {validateTool.data.error}
              </span>
            )}
        </div>
        <div className="flex flex-col gap-1">
          <span>Language</span>
          <Select onValueChange={setLanguage} value={language}>
            <SelectTrigger className="w-1/2 cursor-pointer, capitalize">
              <SelectValue placeholder={language} />
            </SelectTrigger>
            <SelectContent className="capitalize">
              {languageOptions?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1 my-4">
          <span>Categories</span>
          <MultiSelect
            options={explorerCategories.map((category) => ({
              id: category.value,
              label: category.label,
            }))}
            selectedValues={categories}
            onChange={handleCategoriesChange}
            placeholder="Select categories"
          />
        </div>
        <ModelFileUpload
          image={image}
          imageUrl={imageUrl || ''}
          filePath={filePath || ''}
          isDeleteFile={isDeleteFile}
          deleteImage={deleteImage}
          modelType={modelType}
          handleImageUpload={handleFileSelect}
          handleDrop={handleDrop}
          handleImageEditClick={handleImageUploadClick}
          uploadRef={imageUploadRef}
          uploadStatus={uploadStatus}
          uploadProgress={uploadProgress}
        />
        <div className="flex flex-col gap-1">
          <span>Tags</span>
          <Input
            value={tags}
            onChange={setTags}
            placeholder="Tools, Search, etc."
            className="border border-gray-300 dark:border-gray-600 focus:border-yellow-500 dark:focus:border-yellow-400"
          />
        </div>
        <div className="flex justify-end mt-4">
          <Button
            disabled={addTool.isPending || isLoading}
            onClick={submit}
            className="w-32"
          >
            {addTool.isPending || isLoading ? 'Submitting...' : 'Submit Tool'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default AddToolModal;
